'use client';

import { useMemo, useState } from 'react';
import { Bird, BookOpen, ChevronDown, Flame, Gauge, Mountain, Plus, ScrollText, Sparkles, Trash2, Zap } from 'lucide-react';
import { type CourseInput, type Distribution, type Objective, type OptimizationResult, optimizeCourses } from '@/lib/lottery';

const initialCourses: CourseInput[] = [
  { id: 'course-1', name: '课程一', capacity: 400, competitors: 444, value: 5, distribution: { type: 'average', points: 10 } },
  { id: 'course-2', name: '课程二', capacity: 28, competitors: 33, value: 10, distribution: { type: 'average', points: 99 } },
  { id: 'course-3', name: '课程三', capacity: 170, competitors: 181, value: 2, distribution: { type: 'average', points: 0 } },
];

const objectiveLabels: Record<Objective, { title: string; note: string }> = {
  sum: { title: '概率和', note: '尽量多中几门' },
  weighted_sum: { title: '加权概率和', note: '照顾课程价值' },
  product: { title: '概率积', note: '平衡每门风险' },
  weighted_product: { title: '加权概率积', note: '价值与均衡兼顾' },
};

const distributionLabels: Record<Distribution['type'], string> = {
  average: '平均模式',
  uniform: '均匀分布',
  normal: '正态分布',
  mixture: '离散混合',
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function Field({ label, value, onChange, min = 0, max, step = 1, hint }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(numberValue(event.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ProbabilityChart({ values, selected }: { values: number[]; selected: number }) {
  const points = useMemo(() => values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 300},${100 - value * 88}`).join(' '), [values]);
  const x = (selected / Math.max(1, values.length - 1)) * 300;
  const y = 100 - values[selected] * 88;
  return (
    <div className="chart-shell" aria-label="投点与中签概率曲线">
      <svg viewBox="0 0 300 110" role="img">
        <defs>
          <linearGradient id="curve" x1="0" x2="1">
            <stop offset="0" stopColor="#0dc4ba" />
            <stop offset="1" stopColor="#ffb21c" />
          </linearGradient>
        </defs>
        <path d="M0 100H300 M0 56H300 M0 12H300" className="chart-grid" />
        <polyline points={points} fill="none" stroke="url(#curve)" strokeWidth="4" strokeLinejoin="round" />
        <circle cx={x} cy={y} r="6" className="chart-point" />
      </svg>
      <div className="chart-axis"><span>0 点</span><span>99 点</span></div>
    </div>
  );
}

function DistributionFields({ distribution, onChange }: { distribution: Distribution; onChange: (distribution: Distribution) => void }) {
  if (distribution.type === 'average') {
    return <Field label="预测平均投点" value={distribution.points} max={99} onChange={(points) => onChange({ ...distribution, points })} />;
  }
  if (distribution.type === 'uniform') {
    return <div className="field-row"><Field label="最低投点" value={distribution.low} max={99} onChange={(low) => onChange({ ...distribution, low })} /><Field label="最高投点" value={distribution.high} max={99} onChange={(high) => onChange({ ...distribution, high })} /></div>;
  }
  if (distribution.type === 'normal') {
    return <div className="field-row"><Field label="中心估值 μ" value={distribution.mean} max={99} onChange={(mean) => onChange({ ...distribution, mean })} /><Field label="大部分偏差不超 y" value={distribution.mostWithin} min={0.1} max={297} step={0.1} hint={`σ = ${(distribution.mostWithin / 3).toFixed(2)}`} onChange={(mostWithin) => onChange({ ...distribution, mostWithin })} /></div>;
  }
  return (
    <div className="mixture-fields">
      {distribution.components.map((component, index) => (
        <div className="field-row" key={`${index}-${component.points}`}>
          <Field label={`档位 ${index + 1} · 点`} value={component.points} max={99} onChange={(points) => onChange({ ...distribution, components: distribution.components.map((item, itemIndex) => itemIndex === index ? { ...item, points } : item) })} />
          <Field label="比例" value={component.probability} max={1} step={0.05} onChange={(probability) => onChange({ ...distribution, components: distribution.components.map((item, itemIndex) => itemIndex === index ? { ...item, probability } : item) })} />
        </div>
      ))}
      <button className="text-button" type="button" onClick={() => onChange({ ...distribution, components: [...distribution.components, { points: 50, probability: 0 }] })}><Plus size={14} />增加档位</button>
    </div>
  );
}

export default function Home() {
  const [courses, setCourses] = useState(initialCourses);
  const [objective, setObjective] = useState<Objective>('product');
  const [budget, setBudget] = useState(99);
  const [samples, setSamples] = useState(20_000);
  const [seed, setSeed] = useState(20_260_903);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);

  const updateCourse = (id: string, patch: Partial<CourseInput>) => setCourses((current) => current.map((course) => course.id === id ? { ...course, ...patch } : course));
  const changeDistribution = (id: string, type: Distribution['type']) => {
    const defaults: Record<Distribution['type'], Distribution> = {
      average: { type: 'average', points: 20 },
      uniform: { type: 'uniform', low: 0, high: 40 },
      normal: { type: 'normal', mean: 20, mostWithin: 30 },
      mixture: { type: 'mixture', components: [{ points: 0, probability: 0.5 }, { points: 20, probability: 0.3 }, { points: 99, probability: 0.2 }] },
    };
    updateCourse(id, { distribution: defaults[type] });
  };
  const addCourse = () => setCourses((current) => [...current, { id: `course-${Date.now()}`, name: `课程${current.length + 1}`, capacity: 30, competitors: 50, value: 1, distribution: { type: 'average', points: 20 } }]);
  const calculate = () => {
    setCalculating(true);
    setError('');
    setTimeout(() => {
      try {
        setResult(optimizeCourses(courses, budget, objective, samples, seed));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '推演失败，请检查输入。');
      } finally {
        setCalculating(false);
      }
    }, 520);
  };
  const heroMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--px', `${((event.clientX - rect.left) / rect.width - 0.5) * 12}px`);
    event.currentTarget.style.setProperty('--py', `${((event.clientY - rect.top) / rect.height - 0.5) * 8}px`);
  };
  const panelMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
  };

  return (
    <main>
      <section className="hero" onPointerMove={heroMove}>
        <div className="hero-image" />
        <div className="mist mist-one" /><div className="mist mist-two" />
        <div className="torch-glow torch-left" /><div className="torch-glow torch-right" />
        <nav className="topbar"><a className="brand" href="#top"><span>筹</span>点筹司</a><div><a href="#calculator">筹点推演</a><a href="#model">建模卷宗</a></div></nav>
        <div className="hero-copy" id="top">
          <p className="eyebrow"><Mountain size={15} /> 九十九点 · 一局定策</p>
          <h1>把运气，<em>算进山河。</em></h1>
          <p>依据真实票池机制，推演每一枚点数的去处。</p>
          <a className="hero-cta" href="#calculator"><Zap size={17} />开启筹算</a>
        </div>
        <div className="hero-badges"><span><Flame size={15} />0 点亦有一票</span><span><Bird size={15} />全局整数最优</span><span><Gauge size={15} />可复现模拟</span></div>
      </section>

      <div className="scene-transition" aria-hidden="true">
        <div className="cloud-bank cloud-bank-left" />
        <div className="cloud-bank cloud-bank-right" />
        <div className="gate-plaque"><span>穿云入殿</span><i>筹算开局</i></div>
        <div className="gate-light" />
      </div>

      <section className="calculator-wrap" id="calculator">
        <div className="section-heading"><div><span className="seal">壹</span><p>筹点推演</p><h2>录入局势，分配九十九点</h2></div><div className="budget-orb"><strong>{result ? budget - result.usedPoints : budget}</strong><span>{result ? '余点' : '总点'}</span></div></div>

        <div className="control-panel palace-panel">
          <div className="objective-block">
            <div className="control-title"><ScrollText size={18} /><span>选择所求</span></div>
            <div className="objective-grid">
              {(Object.keys(objectiveLabels) as Objective[]).map((key) => <button key={key} type="button" className={objective === key ? 'objective active' : 'objective'} onClick={() => setObjective(key)}><strong>{objectiveLabels[key].title}</strong><small>{objectiveLabels[key].note}</small></button>)}
            </div>
          </div>
          <div className="global-fields"><Field label="点数预算" value={budget} min={0} max={999} onChange={setBudget} /><Field label="模拟次数" value={samples} min={100} max={200000} step={1000} onChange={setSamples} /><Field label="随机种子" value={seed} min={0} step={1} onChange={setSeed} /></div>
        </div>

        <div className="course-list">
          {courses.map((course, index) => (
            <article className="course-card palace-panel" key={course.id} onPointerMove={panelMove} style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}>
              <header><div><span className="course-index">{String(index + 1).padStart(2, '0')}</span><input aria-label={`第${index + 1}门课程名称`} className="course-name" value={course.name} onChange={(event) => updateCourse(course.id, { name: event.target.value })} /></div>{courses.length > 1 && <button aria-label={`删除${course.name}`} className="icon-button" type="button" onClick={() => setCourses((current) => current.filter((item) => item.id !== course.id))}><Trash2 size={16} /></button>}</header>
              <div className="field-row three"><Field label="抽签名额 a" value={course.capacity} onChange={(capacity) => updateCourse(course.id, { capacity })} /><Field label="竞争者 b" value={course.competitors} hint="不含本人" onChange={(competitors) => updateCourse(course.id, { competitors })} /><Field label="课程价值 v" value={course.value} min={0.1} step={0.1} onChange={(value) => updateCourse(course.id, { value })} /></div>
              <label className="field distribution-select"><span>竞争者投点假设</span><select value={course.distribution.type} onChange={(event) => changeDistribution(course.id, event.target.value as Distribution['type'])}>{(Object.keys(distributionLabels) as Distribution['type'][]).map((type) => <option key={type} value={type}>{distributionLabels[type]}</option>)}</select><ChevronDown size={15} /></label>
              <DistributionFields distribution={course.distribution} onChange={(distribution) => updateCourse(course.id, { distribution })} />
            </article>
          ))}
        </div>
        <button className="add-course" type="button" onClick={addCourse}><Plus size={17} />再添一门课程</button>
        <div className="calculate-zone">
          <button className={calculating ? 'compute-button charging' : 'compute-button'} type="button" onClick={calculate} disabled={calculating}><span className="charge-line" /><Sparkles size={20} />{calculating ? '灵枢推演中…' : '开始推演最优投点'}</button>
          <p>平均模式为解析解；其余模型进行指数竞赛模拟</p>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
      </section>

      {result && <section className="results" aria-live="polite">
        <div className="section-heading light"><div><span className="seal">贰</span><p>推演结果</p><h2>点落何处，局势已明</h2></div><div className="result-stamp">最优策</div></div>
        <div className="metric-grid"><div><span>预计中签门数</span><strong>{result.expectedCount.toFixed(3)}</strong></div><div><span>预计课程价值</span><strong>{result.expectedValue.toFixed(3)}</strong></div><div><span>边际概率乘积</span><strong>{percent(result.probabilityProduct)}</strong></div><div><span>已用点数</span><strong>{result.usedPoints}<small> / {budget}</small></strong></div></div>
        <div className="result-list">{result.courses.map((item, index) => <article className="result-card" key={item.course.id} style={{ '--delay': `${index * 120}ms` } as React.CSSProperties}><header><div><span>{item.method}</span><h3>{item.course.name}</h3></div><div className="allocation"><strong>{item.points}</strong><small>投点</small></div></header><ProbabilityChart values={item.curve} selected={item.points} /><dl><div><dt>0点概率</dt><dd>{percent(item.probabilityAtZero)}</dd></div><div><dt>投点后概率</dt><dd>{percent(item.probabilityAfter)}</dd></div><div><dt>概率提升</dt><dd>+{percent(item.probabilityGain)}</dd></div><div><dt>模拟标准误</dt><dd>{percent(item.standardError)}</dd></div></dl></article>)}</div>
        <p className="result-note">概率积只有在各课程抽签独立时才等于“全部中签概率”；否则应理解为风险均衡指标。</p>
      </section>}

      <section className="model" id="model">
        <div className="section-heading"><div><span className="seal">叁</span><p>建模卷宗</p><h2>从票池到最优分配</h2></div><BookOpen size={42} /></div>
        <article className="model-paper">
          <section><span className="chapter">01</span><div><h3>问题与约束</h3><p>第 <i>i</i> 门课有名额 <i>aᵢ</i>、不含本人的竞争者 <i>bᵢ</i>。你投 <i>qᵢ</i> 点便拥有 <i>qᵢ+1</i> 张票；每个人中签后不再重复占名额。</p><div className="equation">qᵢ ∈ {'{0,1,…,99}'}　且　Σ qᵢ ≤ 99</div></div></section>
          <section><span className="chapter">02</span><div><h3>票池的指数竞赛表示</h3><p>给每张票一个独立的 Exp(1) 随机排序键，按键值从小到大读取，等价于随机打乱票池。一个人有 <i>w</i> 张票，其第一次出现时间是这些键值的最小值。</p><div className="equation">Pr(T &gt; t) = (e<sup>−t</sup>)<sup>w</sup> = e<sup>−wt</sup>　⇒　T ~ Exp(w)</div><p>计算机从均匀随机数 <i>U</i> 生成该时间：</p><div className="equation">T = −ln(1−U) / w</div></div></section>
          <section><span className="chapter">03</span><div><h3>竞争者分布</h3><p>竞争者 <i>j</i> 的投点为 <i>Qᵢⱼ</i>，票数为 <i>Wᵢⱼ=Qᵢⱼ+1</i>。可采用同质平均值、整数均匀分布、截断正态分布或离散混合分布。正态模式以中心估值 μ 和大部分偏差范围 <i>y</i> 表示，取 σ=y/3。</p></div></section>
          <section><span className="chapter">04</span><div><h3>单次模拟与条件中签率</h3><p>对所有竞争者生成时间并排序，第 <i>a</i> 小的竞争者时间记作门槛 <i>S</i>。你的至少一张票早于 <i>S</i> 即进入前 <i>a</i> 名。</p><div className="equation">g<sub>q</sub>(S) = 1 − e<sup>−(q+1)S</sup></div><p>同一个门槛可同时计算 q=0,…,99，且不必再把你的结果抽成一次 0 或 1。</p></div></section>
          <section><span className="chapter">05</span><div><h3>蒙特卡洛概率曲线</h3><p>重复生成 N 套竞争者环境，得到门槛 S₁,…,Sₙ，对条件概率取平均：</p><div className="equation">P̂(q) = 1/N · Σᵣ [1 − e<sup>−(q+1)Sᵣ</sup>]</div><p>平均模式中所有竞争者票数相同，程序直接使用解析公式，没有模拟误差。</p></div></section>
          <section><span className="chapter">06</span><div><h3>目标函数与动态规划</h3><p>每门课得到完整概率曲线 Pᵢ(0),…,Pᵢ(99) 后，分别以 Pᵢ、vᵢPᵢ、lnPᵢ 或 vᵢlnPᵢ 作为单课收益。</p><div className="equation">F(i,s) = max<sub>0≤q≤s</sub> [F(i−1,s−q) + Rᵢ(q)]</div><p>整数动态规划枚举全部合法预算划分，因此在给定概率曲线上获得全局最优解。</p></div></section>
        </article>
      </section>

      <footer><span>点筹司</span><p>模型帮助你表达假设，不替代对实际人数与投点分布的判断。</p></footer>
    </main>
  );
}

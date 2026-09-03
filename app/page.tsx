'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bird, BookOpen, ChevronDown, ChevronUp, Flame, Gauge, Mountain, Plus, ScrollText, Sparkles, Trash2, Zap } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { type CourseInput, type Distribution, type Objective, type OptimizationResult, optimizeCourses } from '@/lib/lottery';

const initialCourses: CourseInput[] = [
  { id: 'course-1', name: '课程一', capacity: 400, competitors: 500, value: 1, distribution: { type: 'average', points: 45 } },
  { id: 'course-2', name: '课程二', capacity: 28, competitors: 48, value: 1, distribution: { type: 'average', points: 85 } },
];

const objectiveLabels: Record<Objective, { title: string; note: string }> = {
  sum: { title: '概率和', note: '尽量多中几门' },
  weighted_sum: { title: '加权概率和', note: '照顾权重意愿' },
  product: { title: '概率积', note: '我要全中！' },
  weighted_product: { title: '加权概率积', note: '有选择的全中' },
};

const distributionLabels: Record<Distribution['type'], string> = {
  average: '平均假设',
  uniform: '均匀分布假设',
  normal: '正态分布假设',
  mixture: '离散混合假设',
};

const navSections: { id: string; label: string; num: string; needsResult?: boolean }[] = [
  { id: 'top', label: '卷首', num: '首' },
  { id: 'advice', label: '听君一席话', num: '壹' },
  { id: 'calculator', label: '筹点推演', num: '贰' },
  { id: 'results', label: '推演结果', num: '叁', needsResult: true },
  { id: 'model', label: '建模卷宗', num: '肆' },
];

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function spawnRipple(event: React.MouseEvent<HTMLElement>) {
  const host = event.currentTarget;
  const rect = host.getBoundingClientRect();
  const dot = document.createElement('span');
  const size = Math.max(rect.width, rect.height) * 2.2;
  dot.className = 'ripple';
  dot.style.width = dot.style.height = `${size}px`;
  dot.style.left = `${event.clientX - rect.left - size / 2}px`;
  dot.style.top = `${event.clientY - rect.top - size / 2}px`;
  host.appendChild(dot);
  window.setTimeout(() => dot.remove(), 750);
}

function MathInline({ children }: { children: string }) {
  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: katex.renderToString(children, { throwOnError: false }) }} />;
}

function MathBlock({ children, note }: { children: string; note?: string }) {
  return (
    <figure className="math-block">
      <div dangerouslySetInnerHTML={{ __html: katex.renderToString(children, { displayMode: true, throwOnError: false }) }} />
      {note && <figcaption>{note}</figcaption>}
    </figure>
  );
}

function AmbientParticles() {
  return <div className="ambient" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>;
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.classList.add('revealed');
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          element.classList.add('revealed');
          observer.disconnect();
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 18% 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

function AnimatedNumber({ value, format, duration = 950, className }: { value: number; format: (value: number) => string; duration?: number; className?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

function WaveDivider() {
  return (
    <div className="wave-fade" aria-hidden="true">
      <svg className="wave wave-deep" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d="M-40 0 L2920 0 L2920 46 C2680 88 2440 88 2200 46 S1720 4 1480 46 S1000 88 760 46 S280 4 40 46 L-40 46 Z" fill="rgba(11, 23, 34, .92)" />
      </svg>
      <svg className="wave wave-mid" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d="M-40 0 L2920 0 L2920 54 C2680 96 2440 96 2200 54 S1720 12 1480 54 S1000 96 760 54 S280 12 40 54 L-40 54 Z" fill="rgba(13, 26, 38, .5)" />
      </svg>
      <svg className="wave wave-front" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d="M-40 0 L2920 0 L2920 62 C2680 104 2440 104 2200 62 S1720 20 1480 62 S1000 104 760 62 S280 20 40 62 L-40 62 Z" fill="rgba(16, 30, 42, .24)" />
      </svg>
    </div>
  );
}

const trigramGlyphs = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];

function BaguaOrb({ value, label }: { value: number; label: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const trigrams = root.querySelector<HTMLElement>('.bagua-trigrams');
    const dashed = root.querySelector<HTMLElement>('.bagua-dashed');
    const taiji = root.querySelector<HTMLElement>('.bagua-taiji');
    let frame = 0;
    let running = true;
    let speed = 26;
    let angleTrigrams = 0;
    let angleDashed = 0;
    let angleTaiji = 0;
    let last = performance.now();

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = hoverRef.current ? 330 : 26;
      speed += (target - speed) * Math.min(1, dt * 2.4);
      angleTrigrams = (angleTrigrams + speed * dt) % 360;
      angleDashed = (angleDashed - speed * 0.45 * dt) % 360;
      angleTaiji = (angleTaiji + speed * 0.7 * dt) % 360;
      if (trigrams) trigrams.style.transform = `rotate(${angleTrigrams}deg)`;
      if (dashed) dashed.style.transform = `rotate(${angleDashed}deg)`;
      if (taiji) taiji.style.transform = `rotate(${angleTaiji}deg)`;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="bagua-orb" ref={rootRef} role="img" aria-label={`${label}${Math.round(value)}点`}
      onPointerEnter={() => { hoverRef.current = true; }}
      onPointerLeave={() => { hoverRef.current = false; }}>
      <svg className="bagua-dashed" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(194, 59, 34, .42)" strokeWidth="1.2" strokeDasharray="4 5" />
      </svg>
      <div className="bagua-trigrams" aria-hidden="true">
        {trigramGlyphs.map((glyph, index) => <i key={glyph} style={{ transform: `rotate(${index * 45}deg) translateY(var(--bagua-radius, -57px))` }}>{glyph}</i>)}
      </div>
      <svg className="bagua-taiji" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="#fffdf6" stroke="rgba(47, 46, 43, .22)" strokeWidth="1.5" />
        <path d="M50 3 a47 47 0 0 1 0 94 a23.5 23.5 0 0 1 0-47 a23.5 23.5 0 0 0 0-47" fill="rgba(47, 46, 43, .15)" />
        <circle cx="50" cy="26.5" r="6.5" fill="rgba(47, 46, 43, .17)" />
        <circle cx="50" cy="73.5" r="6.5" fill="#fffdf6" stroke="rgba(47, 46, 43, .12)" strokeWidth="1" />
      </svg>
      <div className="bagua-num">
        <strong><AnimatedNumber value={value} format={(v) => String(Math.round(v))} /></strong>
        <span>{label}</span>
      </div>
    </div>
  );
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
  const gradientId = useId();
  const [hoverQ, setHoverQ] = useState<number | null>(null);
  const activeQ = hoverQ ?? selected;
  const path = useMemo(() => values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${((index / Math.max(1, values.length - 1)) * 300).toFixed(2)} ${(100 - value * 88).toFixed(2)}`).join(' '), [values]);
  const x = (activeQ / Math.max(1, values.length - 1)) * 300;
  const y = 100 - values[activeQ] * 88;
  const tooltipX = Math.min(238, Math.max(4, x - 42));
  const tooltipY = Math.max(4, y - 30);

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / Math.max(1, rect.width);
    setHoverQ(Math.max(0, Math.min(99, Math.round(fraction * 99))));
  };

  return (
    <div className="chart-shell" aria-label="投点与中签概率曲线">
      <svg viewBox="0 0 300 110" role="img" onMouseMove={onMove} onMouseLeave={() => setHoverQ(null)}>
        <defs>
          <linearGradient id={`${gradientId}-line`} x1="0" x2="1">
            <stop offset="0" stopColor="#3f5c6b" />
            <stop offset="1" stopColor="#2f2e2b" />
          </linearGradient>
          <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f5c6b" stopOpacity="0.16" />
            <stop offset="1" stopColor="#3f5c6b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 100H300 M0 56H300 M0 12H300" className="chart-grid" />
        <path d={`${path} L 300 100 L 0 100 Z`} fill={`url(#${gradientId}-area)`} className="curve-area" />
        <path d={path} fill="none" stroke={`url(#${gradientId}-line)`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="curve-path" />
        {hoverQ !== null && <line x1={x} y1="6" x2={x} y2="100" className="cursor-line" />}
        {hoverQ !== null && (
          <g className="chart-tip">
            <rect x={tooltipX} y={tooltipY} width="94" height="21" rx="6" />
            <text x={tooltipX + 47} y={tooltipY + 14}>{`${activeQ} 点 · ${percent(values[activeQ])}`}</text>
          </g>
        )}
        <circle cx={x} cy={y} r={hoverQ !== null ? 5.5 : 6} className={hoverQ !== null ? 'chart-point hovering' : 'chart-point'}>
          <title>{`投 ${activeQ} 点 · 中签率 ${percent(values[activeQ])}`}</title>
        </circle>
      </svg>
      <div className="chart-axis"><span>0 点</span><span>{activeQ} 点</span><span>99 点</span></div>
    </div>
  );
}

function DistributionFields({ distribution, onChange }: { distribution: Distribution; onChange: (distribution: Distribution) => void }) {
  if (distribution.type === 'average') {
    return <Field label="根据经验估计该门课其余人的平均投点数" value={distribution.points} max={99} onChange={(points) => onChange({ ...distribution, points })} />;
  }
  if (distribution.type === 'uniform') {
    return <><Field label="最低投点" value={distribution.low} max={99} onChange={(low) => onChange({ ...distribution, low })} /><Field label="最高投点" value={distribution.high} max={99} onChange={(high) => onChange({ ...distribution, high })} /></>;
  }
  if (distribution.type === 'normal') {
    return <><Field label="中心估值 μ" value={distribution.mean} max={99} onChange={(mean) => onChange({ ...distribution, mean })} /><Field label="大部分偏差不超 y" value={distribution.mostWithin} min={0.1} max={297} step={0.1} hint={`σ = ${(distribution.mostWithin / 3).toFixed(2)}`} onChange={(mostWithin) => onChange({ ...distribution, mostWithin })} /></>;
  }
  return null;
}

function DistributionMixtureFields({ distribution, onChange }: { distribution: Distribution & { type: 'mixture' }; onChange: (distribution: Distribution) => void }) {
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
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('top');
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 70);
      const documentElement = document.documentElement;
      setProgress(Math.min(1, Math.max(0, window.scrollY / Math.max(1, documentElement.scrollHeight - window.innerHeight))));
      let current = 'top';
      for (const section of navSections) {
        if (section.needsResult && !result) continue;
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= window.innerHeight * 0.42) current = section.id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [result]);

  const jumpTo = (id: string) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

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
  useEffect(() => {
    if (!result || calculating) return;
    const timer = setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(timer);
  }, [result, calculating]);

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
      <AmbientParticles />
      <div className="ink-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
      <nav className={scrolled ? 'topbar scrolled' : 'topbar'}><a className="brand" href="#top"><span>筹</span>点筹司</a><div><a href="#calculator">筹点推演</a><a href="#model">建模卷宗</a></div></nav>

      <section className="hero" id="top" onPointerMove={heroMove}>
        <div className="hero-image" />
        <div className="mist mist-one" /><div className="mist mist-two" />
        <div className="torch-glow torch-left" /><div className="torch-glow torch-right" />
        <div className="hero-copy">
          <p className="eyebrow"><Mountain size={15} /> 九十九点 · 一局定策</p>
          <h1 className="hero-brand">点筹司</h1>
          <a className="hero-cta" href="#calculator" onClick={spawnRipple}><Zap size={17} />开启筹算</a>
        </div>
        <div className="hero-badges"><span><Flame size={15} />0 点亦有一票</span><span><Bird size={15} />全局整数最优</span><span><Gauge size={15} />可复现模拟</span></div>
      </section>

      <WaveDivider />

      <div className="bagua-slot">
        <aside className="tips-float" aria-label="填写提示">
          <div className="tips-card">
            <div className="tips-head"><Sparkles size={14} /><span>Tips</span></div>
            <ul>
              <li><b>课程权重意愿 v</b>：对各门课你的倾向权重，建议自行归一化，也可凭感觉加权；只有在选择对应的加权模式以后才起到作用～</li>
              <li><b>竞争者投点假设</b>：大概估计群体规律，总之可以都算算，最后选心理更倾向的～</li>
              <li><b>已选数 b</b>：填当门课当前总人数（记得去掉你自己）</li>
              <li><b>限数 a</b>：这门课打算抽走的名额数</li>
            </ul>
          </div>
        </aside>
        <BaguaOrb value={result ? budget - result.usedPoints : budget} label={result ? '余点' : '总点'} />
      </div>

      <div className="body-layout">
        <div className="body-main">
      <section className="calculator-wrap" id="calculator">
        <Reveal>
          <div className="section-heading" id="advice"><div><span className="seal">壹</span><p>筹策心法</p><h2>听君一席话</h2></div></div>
        </Reveal>
        <Reveal delay={90}>
          <aside className="advice-card" aria-label="筹策心法">
            <div className="advice-strip" aria-hidden="true">点筹司 · 筹策心法</div>
            <header className="advice-head">
              <span>ADVICE & GUIDE · v1.0</span>
              <p>推演开始前的一席话：这个网站从何而来，以及如何把它用明白。</p>
            </header>
            <section className="advice-sec">
              <span className="chapter">01</span>
              <div>
                <p className="model-kicker">About the author</p>
                <h3>关于我</h3>
                <p>本人是 <b>flowwalker</b>，25 级 xb 一枚。</p>
                <p>本网站来自选课截止 2026.9.4 前的一天突发奇想的建模：以 <b>DP + 蒙特卡洛估计 + 对手假设</b>为核心，并在 GPT 的启发下使用<b>指数时间竞赛</b>算法优化了朴素蒙特卡洛（妙不可言～，感叹于当今 AI 的实力）。</p>
                <p>最后一鼓作气借助 GPT + GLM 完成了网页代码。</p>
              </div>
            </section>
            <section className="advice-sec">
              <span className="chapter">02</span>
              <div>
                <p className="model-kicker">How to use</p>
                <h3>关于使用的小引导</h3>
                <p><b>极简使用</b>：无需关注课程权重，按照选课网填入<b>限数</b>和当前<b>已选数</b>；然后根据自己在树洞的了解和常识<b>预测其余人的平均投点</b>。</p>
                <p>例如：爆满英语课 / 体育课 / 爆满通识课至少都得估 &gt;80，而政治课等一般再怎么投点也不会 &gt;40，略微满的通识英语课则估 &lt;10……诸如此类。</p>
                <div className="var-tips">
                  <p className="var-tips-head"><Sparkles size={13} /><span>Tips</span></p>
                  <ul>
                    <li><span>虽说估计别人投点是一件困难的事情，但是事实上只要大概从 0、5、20、50、70、90 中选择一者已经足矣。后续也会进一步稍微更新一点思考，用于通过对于一般不熟悉的课程使用限数 / 已选定义“拥挤度”来直接预测别人的投点。</span></li>
                  </ul>
                </div>
                <p><b>进阶使用</b>：均匀分布——假设在一个区间内均匀分布；</p>
                <p>正态分布——在平均值的基础上根据 3σ 原则（σ ≈ 一般最多不超过的人数偏差 / 3）；</p>
                <p>根据自己的意愿填写<b>课程权重</b>来加权，建议自我归一化，不归一也无伤大雅；</p>
                <p>优化函数自行选择。</p>
              </div>
            </section>
          </aside>
        </Reveal>
        <Reveal>
          <div className="section-heading">
            <div><span className="seal">贰</span><p>筹点推演</p><h2>录入局势，分配九十九点</h2></div>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="control-panel panel" onPointerMove={panelMove}>
            <div className="objective-block">
              <div className="control-title"><ScrollText size={18} /><span>选择所求</span></div>
              <div className="objective-grid">
                {(Object.keys(objectiveLabels) as Objective[]).map((key) => (
                  <button key={key} type="button" className={objective === key ? 'objective active' : 'objective'} onClick={(event) => { spawnRipple(event); setObjective(key); }}>
                    <strong>{objectiveLabels[key].title}</strong>
                    <small>{objectiveLabels[key].note}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="global-fields">
              <Field label="点数预算" value={budget} min={0} max={999} onChange={setBudget} />
              <Field label="模拟次数" value={samples} min={100} max={200000} step={1000} onChange={setSamples} />
              <Field label="随机种子" value={seed} min={0} step={1} onChange={setSeed} />
            </div>
          </div>
        </Reveal>

        <div className="course-list">
          {courses.map((course, index) => (
            <Reveal key={course.id} delay={Math.min(index, 4) * 80}>
              <article className="course-card panel" onPointerMove={panelMove}>
                <header className="course-head">
                  <div className="course-head-main">
                    <span className="course-index">{String(index + 1).padStart(2, '0')}</span>
                    <input aria-label={`第${index + 1}门课程名称`} className="course-name" value={course.name} onChange={(event) => updateCourse(course.id, { name: event.target.value })} />
                  </div>
                  <div className="course-head-fields">
                    <Field label="课程权重意愿 v" value={course.value} min={0.1} step={0.1} onChange={(value) => updateCourse(course.id, { value })} />
                    <label className="field distribution-select"><span>竞争者投点假设</span><select value={course.distribution.type} onChange={(event) => changeDistribution(course.id, event.target.value as Distribution['type'])}>{(Object.keys(distributionLabels) as Distribution['type'][]).map((type) => <option key={type} value={type}>{distributionLabels[type]}</option>)}</select><ChevronDown size={15} /></label>
                  </div>
                  {courses.length > 1 && <button aria-label={`删除${course.name}`} className="icon-button" type="button" onClick={() => setCourses((current) => current.filter((item) => item.id !== course.id))}><Trash2 size={15} /></button>}
                </header>
                <div className="course-fields" data-type={course.distribution.type}>
                  <Field label="限数 a" value={course.capacity} onChange={(capacity) => updateCourse(course.id, { capacity })} />
                  <Field label="已选数 b" value={course.competitors} hint="不含本人" onChange={(competitors) => updateCourse(course.id, { competitors })} />
                  <DistributionFields distribution={course.distribution} onChange={(distribution) => updateCourse(course.id, { distribution })} />
                </div>
                {course.distribution.type === 'mixture' && (
                  <div className="course-dist">
                    <DistributionMixtureFields distribution={course.distribution} onChange={(distribution) => updateCourse(course.id, { distribution })} />
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>

        <div className="calculate-zone">
          <button className="add-course" type="button" onClick={(event) => { spawnRipple(event); addCourse(); }}><Plus size={16} />再添一门课程</button>
          <button className={calculating ? 'compute-button charging' : 'compute-button'} type="button" onClick={(event) => { spawnRipple(event); calculate(); }} disabled={calculating}><span className="charge-line" /><Sparkles size={20} />{calculating ? '灵枢推演中…' : '开始推演最优投点'}</button>
          <p>平均假设为解析解；其余假设进行指数竞赛模拟</p>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
      </section>

      {result && <section className="results" id="results" aria-live="polite" ref={resultsRef}>
        <Reveal>
          <div className="section-heading light">
            <div><span className="seal">叁</span><p>推演结果</p><h2>点落何处，局势已明</h2></div>
            <div className="result-stamp">最优策</div>
          </div>
        </Reveal>
        <div className="metric-grid">
          {[
            { label: '预计中签门数', node: <AnimatedNumber value={result.expectedCount} format={(value) => value.toFixed(3)} /> },
            { label: '预计加权价值', node: <AnimatedNumber value={result.expectedValue} format={(value) => value.toFixed(3)} /> },
            { label: '边际概率乘积', node: <AnimatedNumber value={result.probabilityProduct} format={(value) => percent(value)} /> },
            { label: '已用点数', node: <AnimatedNumber value={result.usedPoints} format={(value) => `${Math.round(value)} / ${budget}`} /> },
          ].map((metric, index) => (
            <Reveal key={metric.label} delay={index * 90} className="metric-cell-wrap">
              <div className="metric-cell"><span>{metric.label}</span><strong>{metric.node}</strong></div>
            </Reveal>
          ))}
        </div>
        <div className="result-list">
          {result.courses.map((item, index) => (
            <Reveal key={item.course.id} delay={180 + index * 130}>
              <article className="result-card">
                <header>
                  <div><span className="method-tag">{item.method}</span><h3>{item.course.name}</h3></div>
                  <div className="allocation"><strong><AnimatedNumber value={item.points} format={(value) => String(Math.round(value))} duration={1100} /></strong><small>投点</small></div>
                </header>
                <ProbabilityChart values={item.curve} selected={item.points} />
                <dl>
                  <div><dt>0点概率</dt><dd>{percent(item.probabilityAtZero)}</dd></div>
                  <div><dt>投点后概率</dt><dd className="dd-gain">{percent(item.probabilityAfter)}</dd></div>
                  <div><dt>概率提升</dt><dd className="dd-gain">+{percent(item.probabilityGain)}</dd></div>
                  <div><dt>模拟标准误</dt><dd>{percent(item.standardError)}</dd></div>
                </dl>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="result-note">概率积只有在各课程抽签独立时才等于“全部中签概率”；否则应理解为风险均衡指标。</p>
      </section>}

      <section className="model" id="model">
        <Reveal>
          <div className="section-heading"><div><span className="seal">肆</span><p>建模卷宗</p><h2>从票池到最优分配</h2></div><BookOpen size={40} /></div>
        </Reveal>
        <Reveal delay={110}>
          <article className="model-paper">
            <div className="paper-strip" aria-hidden="true">点筹司 · 建模卷宗</div>
            <header className="model-paper-header">
              <span>MATHEMATICAL MODEL · v2.0</span>
              <p>天下 PKUer 苦 P 大赌场久矣。为此特设此阵，以助沙漠尘客走出迷茫的沙漠……</p>
            </header>

            <section>
              <span className="chapter">01</span>
              <div>
                <p className="model-kicker">The decision problem</p>
                <h3>我们到底在解决什么问题？</h3>
                <p>共有 <MathInline>{"\\ell"}</MathInline> 门课程。</p>
                <p>课程 <MathInline>{"i"}</MathInline> 有 <MathInline>{"a_i"}</MathInline> 个抽签名额、<MathInline>{"b_i"}</MathInline> 名不包含你的竞争者；你对它的权重意愿记作 <MathInline>{"v_i"}</MathInline>，真正要决定的投点记作 <MathInline>{"q_i"}</MathInline>。</p>
                <p>投零点并非没有票：投入 <MathInline>{"q_i"}</MathInline> 点，实际拥有 <MathInline>{"w_i=q_i+1"}</MathInline> 张票。</p>
                <p>抽签时，我们补充认为抽签是逐次进行的：抽中一人后，此人的其余票全部失效；随后继续抽取，直到产生 <MathInline>{"a_i"}</MathInline> 名不同的中签者。</p>
                <MathBlock note="B 为总点数预算；本工具默认 B = 99。">{"\\begin{aligned}&i=1,\\ldots,\\ell,\\qquad q_i\\in\\{0,1,\\ldots,B\\},\\\\&w_i=q_i+1,\\qquad \\sum_{i=1}^{\\ell}q_i\\le B,\\quad B=99.\\end{aligned}"}</MathBlock>
                <p>记 <MathInline>{"P_i(q)"}</MathInline> 为在课程 <MathInline>{"i"}</MathInline> 投 <MathInline>{"q"}</MathInline> 点时的中签概率。</p>
                <p>我们的问题是，要找到一组满足预算约束的整数投点 <MathInline>{"(q_1,\\ldots,q_\\ell)"}</MathInline>，使整体选课结果最好：</p>
                <MathBlock>{"\\boxed{\\;\\text{选择 }(q_1,\\ldots,q_\\ell),\\text{ 使整体选课结果最好。}\\;}"}</MathBlock>
                <div className="var-tips">
                  <p className="var-tips-head"><Sparkles size={13} /><span>Tips · 小小整理一下变量～</span></p>
                  <ul>
                    <li><MathInline>{"\\ell"}</MathInline><span>课程总数</span></li>
                    <li><MathInline>{"i"}</MathInline><span>第几门课</span></li>
                    <li><MathInline>{"a_i"}</MathInline><span>限数（抽签名额）</span></li>
                    <li><MathInline>{"b_i"}</MathInline><span>竞争者人数（已选数 − 1）</span></li>
                    <li><MathInline>{"v_i"}</MathInline><span>课程权重意愿（偏好权重）</span></li>
                    <li><MathInline>{"q_i"}</MathInline><span>你投入的点数（决策变量）</span></li>
                    <li><MathInline>{"w_i"}</MathInline><span>你的票数，即 w_i = q_i + 1</span></li>
                    <li><MathInline>{"B"}</MathInline><span>总点数预算，默认 99</span></li>
                  </ul>
                </div>
                <p className="model-conclusion">但是，我们要如何描述“整体最好”？↓</p>
              </div>
            </section>

            <section>
              <span className="chapter">02</span>
              <div>
                <p className="model-kicker">Choose the objective</p>
                <h3>什么叫“整体最好”？</h3>
                <p>“整体最好”并没有唯一含义。如果只想尽量多中几门，应最大化各课中签概率之和；若课程的重要程度不同，可以再乘上权重意愿 <MathInline>{"v_i"}</MathInline>。如果我们贪婪地要求全中所有门课，而不在乎其他指标，则可使用概率积，甚至加权概率积。</p>
                <MathBlock>{"\\Phi(q_1,\\ldots,q_\\ell)=\\begin{cases}\\displaystyle\\sum_{i=1}^{\\ell}P_i(q_i),&\\text{概率和},\\\\\\displaystyle\\sum_{i=1}^{\\ell}v_iP_i(q_i),&\\text{加权概率和},\\\\\\displaystyle\\prod_{i=1}^{\\ell}P_i(q_i),&\\text{概率积},\\\\\\displaystyle\\prod_{i=1}^{\\ell}P_i(q_i)^{v_i/\\sum_jv_j},&\\text{加权概率积}.\\end{cases}"}</MathBlock>
                <p>乘积目标取对数后，仍可写成逐课相加的形式。加权积中的归一化指数只改变目标值的尺度，不改变最优投点，因此四种目标可以统一为：</p>
                <MathBlock note="概率积只有在各课程抽签相互独立时，才等于“全部中签”的联合概率；否则应把它理解为风险均衡指标。">{"\\max_{\\sum_iq_i\\le B}\\sum_{i=1}^{\\ell}R_i(q_i),\\qquad R_i(q)=\\begin{cases}P_i(q),&\\text{概率和},\\\\v_iP_i(q),&\\text{加权概率和},\\\\\\ln P_i(q),&\\text{概率积},\\\\v_i\\ln P_i(q),&\\text{加权概率积}.\\end{cases}"}</MathBlock>
                <p className="model-conclusion">我们不妨假设概率分布已经求出，先来研究如何求解全局最优↓</p>
              </div>
            </section>

            <section>
              <span className="chapter">03</span>
              <div>
                <p className="model-kicker">Global integer optimum</p>
                <h3>不妨假设概率已知，如何求解全局最优？</h3>
                <p>经过一番思考，可以发现这里存在动态规划（DP）解法。</p>
                <p>暂且假设每门课从零点到满点的概率曲线 <MathInline>{"P_i(0),\\ldots,P_i(B)"}</MathInline> 已经全部知道。此时问题只剩一个有限的整数资源分配。令 <MathInline>{"F(i,s)"}</MathInline> 表示前 <MathInline>{"i"}</MathInline> 门课程恰好使用 <MathInline>{"s"}</MathInline> 点时能够取得的最大总收益。</p>
                <MathBlock>{"F(0,0)=0,\\qquad F(0,s)=-\\infty\\quad(s>0)."}</MathBlock>
                <MathBlock>{"F(i,s)=\\max_{0\\le q\\le s}\\left\\{F(i-1,s-q)+R_i(q)\\right\\}."}</MathBlock>
                <MathBlock>{"\\Phi^\\star=\\max_{0\\le s\\le B}F(\\ell,s)."}</MathBlock>
                <p>递推时枚举第 <MathInline>{"i"}</MathInline> 门课的全部合法投点 <MathInline>{"q"}</MathInline>，把余下的 <MathInline>{"s-q"}</MathInline> 点交给前面的课程；最后记录每一步取到最大值的选择，便可回溯得到 <MathInline>{"(q_1^\\star,\\ldots,q_\\ell^\\star)"}</MathInline>。因此，相对于给定的概率曲线，这不是局部试探，而是全局整数最优。</p>
                <p className="model-conclusion">至此，我们发现，只要求出概率分布，严格最优解唾手可得。<br />为此，让我们先考虑一个任意投点分布下的中签概率是否可求↓</p>
              </div>
            </section>

            <section>
              <span className="chapter">04</span>
              <div>
                <p className="model-kicker">The direct probability solver</p>
                <h3>在一个投点分布下，如何求解中签概率？</h3>
                <p>由于分布带来的不确定性，我们发现很难直接求得便于计算的定式；纵使使用级数表示，也未必是计算最优、最快的方法。为此，我们考虑使用蒙特卡洛法进行如下建模。</p>
                <p>以下称为“朴素蒙特卡洛”，因为后文还有令人称妙的优化蒙特卡洛——参见第六章。</p>
                <p>先把竞争者 <MathInline>{"j"}</MathInline> 在课程 <MathInline>{"i"}</MathInline> 的投点看成来自某个给定分布 <MathInline>{"D_i"}</MathInline> 的随机变量：<MathInline>{"Q_{ij}\\sim D_i"}</MathInline>，票数为 <MathInline>{"W_{ij}=Q_{ij}+1"}</MathInline>。只要这个分布已经给定，最朴素的蒙特卡洛便能忠实重演抽签。</p>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">一轮重演</span><h4>直接朴素模拟</h4><em>直观基线</em></div>
                  <p>固定你的投点 <MathInline>{"q"}</MathInline>，先从 <MathInline>{"D_i"}</MathInline> 中抽出所有竞争者的投点，再把每个人的全部票放进池中。每轮均匀抽出一张票；若其主人尚未中签，便记下一名中签者并移除他的其余票，直至产生 <MathInline>{"a_i"}</MathInline> 名不同的人。</p>
                  <MathBlock>{"Q_{ij}^{(r)}\\sim D_i,\\qquad W_{\\mathrm{pool},i}^{(r)}=(q+1)+\\sum_{j=1}^{b_i}\\left(Q_{ij}^{(r)}+1\\right)."}</MathBlock>
                </div>
                <p>令 <MathInline>{"Y_{i,q}^{(r)}"}</MathInline> 表示第 <MathInline>{"r"}</MathInline> 次重演中你是否中签。重复 <MathInline>{"N"}</MathInline> 次，中签频率便估计了投 <MathInline>{"q"}</MathInline> 点时的概率：</p>
                <MathBlock>{"Y_{i,q}^{(r)}=\\mathbf 1\\{\\text{第 }r\\text{ 次重演中你中签}\\},\\qquad \\widehat P_i^{\\,\\mathrm{naive}}(q)=\\frac1N\\sum_{r=1}^{N}Y_{i,q}^{(r)}."}</MathBlock>
                <p>这个办法是正确但笨重的，却十分利于理解；后面我们将采取优化后的算法来加速计算。</p>
                <p className="model-conclusion">因此，事实上目前我们更应该关注的是：如何估计 <MathInline>{"D_i"}</MathInline>，如何揣摩别人的投法↓</p>
              </div>
            </section>

            <section>
              <span className="chapter">05</span>
              <div>
                <p className="model-kicker">Model the competitors</p>
                <h3>估计竞争者投点分布</h3>
                <p>分布 <MathInline>{"D_i"}</MathInline> 不是抽签规则，而是我们对竞争者行为作出的假设。一般认为，以下几种模型足以覆盖常见使用情形；它们共享同一套抽签机制，只在“别人可能投多少点”这一步不同。</p>
                <MathBlock>{"Q_{ij}\\sim D_i=\\begin{cases}t_i,&\\text{平均假设},\\\\\\operatorname{UnifInteger}(L_i,H_i),&\\text{整数均匀假设},\\\\\\operatorname{Round}(Z_{ij}),\\;Z_{ij}\\sim N(\\mu_i,(y_i/3)^2)\\mid 0\\le Z_{ij}\\le99,&\\text{截断正态假设},\\\\\\displaystyle\\sum_{h=1}^{H}p_{ih}\\,\\delta_{c_{ih}},\\;\\sum_hp_{ih}=1,&\\text{离散混合假设}.\\end{cases}"}</MathBlock>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">基线</span><h4>平均假设</h4><em>所有人固定投 tᵢ 点</em></div>
                  <p>适合只有一个中心估计、暂时不描述人群差异的情形。这里的“平均”是把所有概率质量压在同一点上，并不等同于任意一个均值相同的随机分布。</p>
                </div>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">差异</span><h4>均匀与正态</h4><em>围绕区间或中心波动</em></div>
                  <p>整数均匀模式认为区间 <MathInline>{"[L_i,H_i]"}</MathInline> 内各整数同样可能；截断正态模式以 <MathInline>{"\\mu_i"}</MathInline> 为中心，并用 <MathInline>{"y_i"}</MathInline> 表示“大部分人不会偏离中心超过的范围”，取 <MathInline>{"\\sigma_i=y_i/3"}</MathInline>。</p>
                </div>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">分群</span><h4>离散混合</h4><em>直接描述不同投点人群</em></div>
                  <p>离散混合模式把若干典型投点 <MathInline>{"c_{ih}"}</MathInline> 与其比例 <MathInline>{"p_{ih}"}</MathInline> 直接列出，可用来描述零点党、普通投点者和高点或满点投点者。</p>
                </div>
                <p className="model-conclusion">仅知道平均投点，通常不足以确定随机分布模式下的中签率。抽签包含排序、去重和门槛，概率会受到整个分布形状影响；因此最好把不确定性明确写进 <MathInline>{"D_i"}</MathInline>，并比较几种合理假设下的结果。</p>
              </div>
            </section>

            <section>
              <span className="chapter">06</span>
              <div>
                <p className="model-kicker">A faster probability engine</p>
                <h3>对于概率求解的一种妙哉优化</h3>
                <p>朴素票池似乎足矣，但我们希望更快，对吧？首先，对于平均假设的情况，我们显然有闭式解。其次，对于其他情况，经过一番与 GPT 的交流探索——妙哉，指数时间竞赛算法！</p>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">（1）</span><h4>平均分布假设的闭式解</h4><em>无模拟误差</em></div>
                  <p>若所有竞争者都固定投 <MathInline>{"t_i"}</MathInline> 点，则每人有 <MathInline>{"t_i+1"}</MathInline> 张票。在你尚未中签且已有 <MathInline>{"j"}</MathInline> 名竞争者离场时，下一轮仍未抽中你的概率可以直接写出；连乘 <MathInline>{"a_i"}</MathInline> 轮，再取补集即可。</p>
                  <MathBlock note="非平凡情形的每一轮分母都明确包含你的 q+1 张票。">{"P_i(q)=\\begin{cases}0,&a_i=0,\\\\1,&a_i>b_i,\\\\1-\\displaystyle\\prod_{j=0}^{a_i-1}\\frac{(b_i-j)(t_i+1)}{(b_i-j)(t_i+1)+(q+1)},&1\\le a_i\\le b_i.\\end{cases}"}</MathBlock>
                </div>
                <div className="sim-step sim-step-key">
                  <div className="sim-step-head"><span className="sim-step-tag">（2）</span><h4>任意分布的求解优化：指数时间竞赛</h4><em>每个人只生成一个数</em></div>
                  <p>给每张票一个相互独立的 <MathInline>{"\\operatorname{Exp}(1)"}</MathInline> 随机时间。连续同分布随机变量的大小次序是均匀随机排列，所以按时间顺序读票，与随机打乱真实票池完全等价。一个拥有 <MathInline>{"w"}</MathInline> 张票的人，其首次出现时间是这些时间的最小值：</p>
                  <MathBlock>{"\\begin{aligned}T&=\\min(X_1,\\ldots,X_w),&X_r&\\overset{\\mathrm{iid}}{\\sim}\\operatorname{Exp}(1),\\\\\\Pr(T>t)&=(e^{-t})^w=e^{-wt},&\\therefore\\quad T&\\sim\\operatorname{Exp}(w).\\end{aligned}"}</MathBlock>
                  <p>于是无需生成他的全部票，只需一次逆变换采样：</p>
                  <MathBlock>{"U\\sim\\operatorname{Unif}(0,1),\\qquad T=\\frac{-\\ln(1-U)}{w}."}</MathBlock>
                  <p>在第 <MathInline>{"r"}</MathInline> 次竞争环境中，为每名竞争者生成 <MathInline>{"T_{ij}^{(r)}\\sim\\operatorname{Exp}(Q_{ij}^{(r)}+1)"}</MathInline>，其第 <MathInline>{"a_i"}</MathInline> 小值 <MathInline>{"S_i^{(r)}"}</MathInline> 就是中签门槛。你的指数时间小于该门槛便能中签，因此无需再随机生成你的时间，而可以直接写出条件概率：</p>
                  <MathBlock>{"G_{i,q}^{(r)}=\\Pr(T_{\\mathrm{you},i}<S_i^{(r)}\\mid S_i^{(r)})=1-e^{-(q+1)S_i^{(r)}}."}</MathBlock>
                  <p>同一个门槛可以同时代入全部 <MathInline>{"q=0,\\ldots,B"}</MathInline>。对 <MathInline>{"N"}</MathInline> 次环境取平均，便得到整条概率曲线及其蒙特卡洛标准误：</p>
                  <MathBlock>{"\\widehat P_i(q)=\\frac1N\\sum_{r=1}^{N}G_{i,q}^{(r)},\\qquad \\widehat{\\operatorname{SE}}_i(q)=\\sqrt{\\frac{\\frac1N\\sum_{r=1}^{N}(G_{i,q}^{(r)})^2-\\widehat P_i(q)^2}{N}}."}</MathBlock>
                </div>
                <p className="model-conclusion">这一步同时完成了三次压缩：从“每张票一个随机数”到“每个人一个随机数”，从“完整排序”到只寻找第 <MathInline>{"a_i"}</MathInline> 小的门槛，再从每次只记录中或不中，变成直接使用该环境下的条件中签概率。</p>
              </div>
            </section>

            <section>
              <span className="chapter">07</span>
              <div>
                <p className="model-kicker">The complete algorithm</p>
                <h3>于是乎，成！</h3>
                <p>万事俱备，则可成一范式如下：</p>
                <div className="sim-step-head"><span className="sim-step-tag">操作范式</span><h4>从输入到结果</h4><em>照此使用</em></div>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">输入</span><h4>写下局势与偏好</h4><em>课程参数</em></div>
                  <p>输入每门课程的 <MathInline>{"a_i,b_i,v_i"}</MathInline>、竞争者分布 <MathInline>{"D_i"}</MathInline>、总预算 <MathInline>{"B"}</MathInline>、模拟次数与随机种子，并选择概率和、加权概率和、概率积或加权概率积。</p>
                </div>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">概率</span><h4>逐课生成完整曲线</h4><em>解析或模拟</em></div>
                  <p>若 <MathInline>{"D_i"}</MathInline> 为平均假设，使用闭式公式精确计算 <MathInline>{"P_i(0),\\ldots,P_i(B)"}</MathInline>；否则重复采样竞争者投点和指数时间，取得门槛 <MathInline>{"S_i^{(r)}"}</MathInline>，再用 <MathInline>{"1-e^{-(q+1)S_i^{(r)}}"}</MathInline> 同时累计所有候选点数。</p>
                </div>
                <div className="sim-step">
                  <div className="sim-step-head"><span className="sim-step-tag">分配</span><h4>动态规划并回溯</h4><em>全局整数最优</em></div>
                  <p>把概率曲线代入所选目标得到 <MathInline>{"R_i(q)"}</MathInline>，计算动态规划表 <MathInline>{"F(i,s)"}</MathInline>，在 <MathInline>{"0\\le s\\le B"}</MathInline> 中选出最大值，并沿记录的选择回溯得到最优投点。</p>
                </div>

                <p>至此，理论的全流程如下：</p>
                <div className="sim-step-head"><span className="sim-step-tag">理论综合</span><h4>把前文正着写一遍</h4><em>从假设到最优解</em></div>
                <div className="sim-step sim-step-key">
                  <p>第一步，实况与经验假设给出竞争者投点，投点加一成为票数：</p>
                  <MathBlock>{"Q_{ij}^{(r)}\\sim D_i,\\qquad W_{ij}^{(r)}=Q_{ij}^{(r)}+1."}</MathBlock>

                  <p>第二步，若采用平均分布假设，则直接得到无模拟误差的概率曲线：</p>
                  <MathBlock note="aᵢ = 0 时概率为 0；aᵢ > bᵢ 时概率为 1。">{"P_i(q)=1-\\prod_{j=0}^{a_i-1}\\frac{(b_i-j)(t_i+1)}{(b_i-j)(t_i+1)+(q+1)}."}</MathBlock>

                  <p>若采用其他投点分布，则为每名竞争者生成指数时间：</p>
                  <MathBlock>{"T_{ij}^{(r)}=\\frac{-\\ln(1-U_{ij}^{(r)})}{W_{ij}^{(r)}},\\qquad U_{ij}^{(r)}\\sim\\operatorname{Unif}(0,1)."}</MathBlock>

                  <p>第三步，将竞争者时间排序，第 <MathInline>{"a_i"}</MathInline> 小的时间成为该轮门槛：</p>
                  <MathBlock>{"T_{i,(1)}^{(r)}\\le\\cdots\\le T_{i,(b_i)}^{(r)},\\qquad S_i^{(r)}=T_{i,(a_i)}^{(r)}."}</MathBlock>

                  <p>第四步，复用每轮门槛，同时估计从零点到预算上限的整条概率曲线：</p>
                  <MathBlock>{"\\widehat P_i(q)=\\frac1N\\sum_{r=1}^{N}\\left[1-e^{-(q+1)S_i^{(r)}}\\right],\\qquad q=0,\\ldots,B."}</MathBlock>

                  <p>第五步，把每门课的中签概率按所选目标变成单课收益：</p>
                  <MathBlock>{"R_i(q)=\\begin{cases}P_i(q),&\\text{概率和},\\\\v_iP_i(q),&\\text{加权概率和},\\\\\\ln P_i(q),&\\text{概率积},\\\\v_i\\ln P_i(q),&\\text{加权概率积}.\\end{cases}"}</MathBlock>

                  <p>第六步，将所有单课收益交给动态规划：</p>
                  <MathBlock>{"F(i,s)=\\max_{0\\le q\\le s}\\left\\{F(i-1,s-q)+R_i(q)\\right\\}."}</MathBlock>

                  <p>第七步，从最优总用点数回溯，取回完整投点方案：</p>
                  <MathBlock>{"s^\\star\\in\\arg\\max_{0\\le s\\le B}F(\\ell,s),\\qquad(q_1^\\star,\\ldots,q_\\ell^\\star)=\\operatorname{Backtrack}(s^\\star)."}</MathBlock>
                </div>

                <MathBlock>{"\\boxed{\\text{实况+经验假设}\\;\\longrightarrow\\;P_i(0{:}B)\\;\\longrightarrow\\;R_i(0{:}B)\\;\\longrightarrow\\;\\mathrm{DP}\\;\\longrightarrow\\;(q_1^\\star,\\ldots,q_\\ell^\\star)}"}</MathBlock>
                <p className="model-conclusion">至此，赌场不过云烟——<del>虽说，首先你得先估准其他人的投点分布</del>，而能成此者，也不枉为赌王（x）。</p>
              </div>
            </section>
          </article>
        </Reveal>
      </section>
        </div>

        <aside className="side-rail">
          <div className="rail-card rail-identity">
            <div className="rail-id-top">
              <span className="rail-seal">筹</span>
              <div><strong>点筹司</strong><small>点筹推演 · 司职其事</small></div>
            </div>
            <p>依真实票池机制推演中签概率，再以整数动态规划全局分配九十九点。</p>
            <div className="rail-tags"><span><Flame size={13} />0 点有票</span><span><Bird size={13} />全局最优</span><span><Gauge size={13} />可复现</span></div>
            <div className="rail-meta">v1.0 · 本机运算 · 数据不出门</div>
          </div>

          <div className="rail-card rail-toc">
            <div className="rail-head"><ScrollText size={15} /><span>筹算目录</span><small>肆章</small></div>
            <div className="rail-toc-list">
              {navSections.filter((section) => !section.needsResult || result).map((section) => (
                <button key={section.id} type="button" className={activeSection === section.id ? 'active' : ''} onClick={() => jumpTo(section.id)}>
                  <span className="rail-toc-num">{section.num}</span>
                  <span className="rail-toc-label">{section.label}</span>
                  <i className="rail-toc-dot" />
                </button>
              ))}
            </div>
          </div>

          <div className="rail-card rail-tips">
            <div className="rail-head"><Sparkles size={15} /><span>司规要义</span></div>
            <ul>
              <li>平均假设即解析解；其余假设先以两万次粗算，定稿再提至十万次并查看标准误。</li>
            </ul>
          </div>
        </aside>
      </div>

      <footer>
        <div className="footer-inner">
          <span className="footer-brand">点筹司</span>
          <p>模型帮助你表达假设，不替代对实际人数与投点分布的判断。</p>
          <a className="footer-top" href="#top" onClick={spawnRipple}><ChevronUp size={15} />回到卷首</a>
        </div>
      </footer>
    </main>
  );
}

export type Distribution =
  | { type: 'average'; points: number }
  | { type: 'uniform'; low: number; high: number }
  | { type: 'normal'; mean: number; mostWithin: number }
  | { type: 'mixture'; components: { points: number; probability: number }[] };

export type Objective = 'sum' | 'weighted_sum' | 'product' | 'weighted_product';

export interface CourseInput {
  id: string;
  name: string;
  capacity: number;
  competitors: number;
  value: number;
  distribution: Distribution;
  primeOnly?: boolean;
  primeShare?: number;
}

export interface ProbabilityCurve {
  probabilities: number[];
  standardErrors: number[];
  method: '解析公式' | '指数竞赛模拟' | '确定结果';
}

export interface CourseResult {
  course: CourseInput;
  points: number;
  probabilityAtZero: number;
  probabilityAfter: number;
  probabilityGain: number;
  nextPointGain: number;
  standardError: number;
  method: string;
  curve: number[];
}

export interface OptimizationResult {
  allocations: number[];
  usedPoints: number;
  expectedCount: number;
  expectedValue: number;
  probabilityProduct: number;
  weightedGeometricProbability: number;
  objectiveValue: number;
  courses: CourseResult[];
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export const PRIME_POINT_OPTIONS = [0, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 99] as const;

export function primePointCandidates(points: number): number[] {
  const bounded = Math.min(99, Math.max(0, points));
  for (let index = 0; index < PRIME_POINT_OPTIONS.length; index += 1) {
    const upper = PRIME_POINT_OPTIONS[index];
    if (bounded === upper || (index === 0 && bounded < upper)) return [upper];
    if (bounded < upper) {
      const lower = PRIME_POINT_OPTIONS[index - 1];
      const lowerDistance = bounded - lower;
      const upperDistance = upper - bounded;
      if (Math.abs(lowerDistance - upperDistance) < 1e-12) return [lower, upper];
      return [lowerDistance < upperDistance ? lower : upper];
    }
  }
  return [99];
}

export function applyPrimePointRule(points: number, rng: () => number): number {
  const candidates = primePointCandidates(points);
  return candidates.length === 1 ? candidates[0] : candidates[rng() < 0.5 ? 0 : 1];
}

function sampleBasePoints(distribution: Distribution, rng: () => number) {
  if (distribution.type === 'average') return distribution.points;
  if (distribution.type === 'uniform') {
    return Math.floor(distribution.low + rng() * (distribution.high - distribution.low + 1));
  }
  if (distribution.type === 'normal') {
    const sigma = distribution.mostWithin / 3;
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      const value = distribution.mean + sigma * gaussian(rng);
      if (value >= 0 && value <= 99) return Math.round(value);
    }
    return Math.min(99, Math.max(0, Math.round(distribution.mean)));
  }
  const target = rng();
  let cumulative = 0;
  for (const component of distribution.components) {
    cumulative += component.probability;
    if (target <= cumulative) return component.points;
  }
  return distribution.components.at(-1)?.points ?? 0;
}

function samplePoints(course: CourseInput, rng: () => number) {
  const points = sampleBasePoints(course.distribution, rng);
  if (!course.primeOnly) return points;
  const primeShare = course.primeShare ?? 1;
  if (primeShare <= 0) return points;
  if (primeShare < 1 && rng() >= primeShare) return points;
  return applyPrimePointRule(points, rng);
}

function quickselect(values: number[], target: number) {
  let left = 0;
  let right = values.length - 1;
  while (left < right) {
    const pivot = values[(left + right) >> 1];
    let i = left;
    let j = right;
    while (i <= j) {
      while (values[i] < pivot) i += 1;
      while (values[j] > pivot) j -= 1;
      if (i <= j) {
        [values[i], values[j]] = [values[j], values[i]];
        i += 1;
        j -= 1;
      }
    }
    if (target <= j) right = j;
    else if (target >= i) left = i;
    else return values[target];
  }
  return values[left];
}

function analyticCurve(course: CourseInput, budget: number, opponentPoints: number): ProbabilityCurve {
  if (course.capacity === 0) {
    return { probabilities: Array(budget + 1).fill(0), standardErrors: Array(budget + 1).fill(0), method: '确定结果' };
  }
  if (course.capacity > course.competitors) {
    return { probabilities: Array(budget + 1).fill(1), standardErrors: Array(budget + 1).fill(0), method: '确定结果' };
  }
  const opponentTickets = opponentPoints + 1;
  const probabilities = Array.from({ length: budget + 1 }, (_, points) => {
    const ownTickets = points + 1;
    let logMiss = 0;
    for (let drawn = 0; drawn < course.capacity; drawn += 1) {
      const remaining = (course.competitors - drawn) * opponentTickets;
      logMiss += Math.log(remaining / (remaining + ownTickets));
    }
    return -Math.expm1(logMiss);
  });
  return { probabilities, standardErrors: Array(budget + 1).fill(0), method: '解析公式' };
}

function simulatedCurve(course: CourseInput, budget: number, samples: number, seed: number): ProbabilityCurve {
  if (course.capacity === 0) {
    return { probabilities: Array(budget + 1).fill(0), standardErrors: Array(budget + 1).fill(0), method: '确定结果' };
  }
  if (course.capacity > course.competitors) {
    return { probabilities: Array(budget + 1).fill(1), standardErrors: Array(budget + 1).fill(0), method: '确定结果' };
  }
  const rng = mulberry32(seed);
  const totals = Array(budget + 1).fill(0);
  const squares = Array(budget + 1).fill(0);
  const times = Array.from({ length: course.competitors }, () => 0);
  for (let sample = 0; sample < samples; sample += 1) {
    for (let j = 0; j < course.competitors; j += 1) {
      const tickets = samplePoints(course, rng) + 1;
      times[j] = -Math.log1p(-rng()) / tickets;
    }
    const threshold = quickselect(times, course.capacity - 1);
    for (let points = 0; points <= budget; points += 1) {
      const probability = -Math.expm1(-(points + 1) * threshold);
      totals[points] += probability;
      squares[points] += probability * probability;
    }
  }
  const probabilities = totals.map((total) => total / samples);
  const standardErrors = totals.map((total, index) => {
    const mean = total / samples;
    const variance = Math.max(0, squares[index] / samples - mean * mean);
    return Math.sqrt(variance / samples);
  });
  return { probabilities, standardErrors, method: '指数竞赛模拟' };
}

function deterministicOpponentPoints(course: CourseInput): number | null {
  if (course.distribution.type !== 'average') return null;
  if (!course.primeOnly) return course.distribution.points;
  const primeShare = course.primeShare ?? 1;
  if (primeShare <= 0) return course.distribution.points;
  const candidates = primePointCandidates(course.distribution.points);
  if (candidates.length === 1 && candidates[0] === course.distribution.points) return candidates[0];
  return primeShare >= 1 && candidates.length === 1 ? candidates[0] : null;
}

function reward(probability: number, value: number, objective: Objective) {
  if (objective === 'sum') return probability;
  if (objective === 'weighted_sum') return value * probability;
  if (probability <= 0) return Number.NEGATIVE_INFINITY;
  if (objective === 'product') return Math.log(probability);
  return value * Math.log(probability);
}

export function validateCourses(courses: CourseInput[]) {
  if (courses.length === 0) throw new Error('请至少添加一门课程。');
  for (const course of courses) {
    if (!course.name.trim()) throw new Error('课程名称不能为空。');
    if (!Number.isInteger(course.capacity) || course.capacity < 0) throw new Error(`${course.name}：名额必须是非负整数。`);
    if (!Number.isInteger(course.competitors) || course.competitors < 0) throw new Error(`${course.name}：竞争者人数必须是非负整数。`);
    if (!(course.value > 0)) throw new Error(`${course.name}：课程价值必须大于 0。`);
    const distribution = course.distribution;
    const primeShare = course.primeShare ?? 1;
    if (course.primeOnly && (!Number.isFinite(primeShare) || primeShare < 0 || primeShare > 1)) throw new Error(`${course.name}：质数投点信徒的预测占比须在 0—1。`);
    if (distribution.type === 'average' && !(distribution.points >= 0 && distribution.points <= 99)) throw new Error(`${course.name}：平均投点须在 0—99。`);
    if (distribution.type === 'uniform' && !(distribution.low >= 0 && distribution.high <= 99 && distribution.low <= distribution.high)) throw new Error(`${course.name}：均匀分布范围无效。`);
    if (distribution.type === 'normal' && !(distribution.mean >= 0 && distribution.mean <= 99 && distribution.mostWithin > 0)) throw new Error(`${course.name}：正态分布参数无效。`);
    if (distribution.type === 'mixture') {
      const total = distribution.components.reduce((sum, item) => sum + item.probability, 0);
      if (distribution.components.length === 0 || distribution.components.some((item) => item.points < 0 || item.points > 99 || item.probability < 0) || Math.abs(total - 1) > 1e-6) {
        throw new Error(`${course.name}：混合分布档位须在 0—99，概率之和须为 1。`);
      }
    }
  }
}

export function optimizeCourses(courses: CourseInput[], budget: number, objective: Objective, samples: number, seed: number): OptimizationResult {
  validateCourses(courses);
  const curves = courses.map((course, index) => {
    const opponentPoints = deterministicOpponentPoints(course);
    return opponentPoints === null
      ? simulatedCurve(course, budget, samples, seed + index * 1_000_003)
      : analyticCurve(course, budget, opponentPoints);
  });
  const count = courses.length;
  const dp = Array.from({ length: count + 1 }, () => Array(budget + 1).fill(Number.NEGATIVE_INFINITY));
  const choices = Array.from({ length: count + 1 }, () => Array(budget + 1).fill(0));
  dp[0][0] = 0;
  for (let i = 1; i <= count; i += 1) {
    for (let used = 0; used <= budget; used += 1) {
      for (let points = 0; points <= used; points += 1) {
        const previous = dp[i - 1][used - points];
        const currentReward = reward(curves[i - 1].probabilities[points], courses[i - 1].value, objective);
        const score = previous + currentReward;
        if (Number.isFinite(score) && score > dp[i][used]) {
          dp[i][used] = score;
          choices[i][used] = points;
        }
      }
    }
  }
  const best = Math.max(...dp[count]);
  if (!Number.isFinite(best)) throw new Error('当前设置下有课程中签率恒为 0，概率积目标无法计算。');
  const usedPoints = dp[count].findIndex((score) => Math.abs(score - best) < 1e-12);
  const allocations = Array(count).fill(0);
  let remaining = usedPoints;
  for (let i = count; i > 0; i -= 1) {
    allocations[i - 1] = choices[i][remaining];
    remaining -= allocations[i - 1];
  }
  const selected = allocations.map((points, index) => curves[index].probabilities[points]);
  const expectedCount = selected.reduce((sum, probability) => sum + probability, 0);
  const expectedValue = selected.reduce((sum, probability, index) => sum + probability * courses[index].value, 0);
  const probabilityProduct = selected.reduce((product, probability) => product * probability, 1);
  const totalValue = courses.reduce((sum, course) => sum + course.value, 0);
  const weightedGeometricProbability = probabilityProduct <= 0 ? 0 : Math.exp(selected.reduce((sum, probability, index) => sum + courses[index].value * Math.log(probability), 0) / totalValue);
  const objectiveValue = objective === 'sum' ? expectedCount : objective === 'weighted_sum' ? expectedValue : objective === 'product' ? probabilityProduct : weightedGeometricProbability;
  return {
    allocations,
    usedPoints,
    expectedCount,
    expectedValue,
    probabilityProduct,
    weightedGeometricProbability,
    objectiveValue,
    courses: courses.map((course, index) => {
      const points = allocations[index];
      return {
        course,
        points,
        probabilityAtZero: curves[index].probabilities[0],
        probabilityAfter: curves[index].probabilities[points],
        probabilityGain: curves[index].probabilities[points] - curves[index].probabilities[0],
        nextPointGain: points < budget ? curves[index].probabilities[points + 1] - curves[index].probabilities[points] : 0,
        standardError: curves[index].standardErrors[points],
        method: `${curves[index].method}${course.primeOnly ? ` · 质数化 ${Math.round((course.primeShare ?? 1) * 100)}%` : ''}`,
        curve: curves[index].probabilities,
      };
    }),
  };
}

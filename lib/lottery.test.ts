import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ADAPTIVE_PARAMETERS,
  POSITIVE_PRIME_POINT_OPTIONS,
  adaptiveDistribution,
  adaptiveMeanPoints,
  adaptiveSpreadIndex,
  applyPrimePointRule,
  type CourseInput,
  optimizeCourses,
  primePointCandidates,
} from './lottery.ts';

void test('质数化保留 0、质数与 99', () => {
  assert.deepEqual(primePointCandidates(0), [0]);
  assert.deepEqual(primePointCandidates(29), [29]);
  assert.deepEqual(primePointCandidates(99), [99]);
});

void test('质数化就近映射并在等距时公平分流', () => {
  assert.deepEqual(primePointCandidates(20), [19]);
  assert.deepEqual(primePointCandidates(12), [11, 13]);
  assert.equal(applyPrimePointRule(12, () => 0.49), 11);
  assert.equal(applyPrimePointRule(12, () => 0.5), 13);
  assert.equal(applyPrimePointRule(98, () => 0.1), 97);
  assert.equal(applyPrimePointRule(98, () => 0.9), 99);
});

void test('平均投点质数化后的唯一落点继续使用解析解', () => {
  const common = { id: 'course', name: '课程', capacity: 2, competitors: 5, value: 1 };
  const primeCourse: CourseInput = { ...common, distribution: { type: 'average', points: 20 }, primeOnly: true };
  const fixedCourse: CourseInput = { ...common, distribution: { type: 'average', points: 19 } };
  const primeResult = optimizeCourses([primeCourse], 8, 'sum', 500, 42);
  const fixedResult = optimizeCourses([fixedCourse], 8, 'sum', 500, 42);

  assert.equal(primeResult.courses[0].method, '解析公式 · 质数化 100%');
  assert.deepEqual(primeResult.courses[0].curve, fixedResult.courses[0].curve);
});

void test('平均投点位于两个允许点中间时使用可复现模拟', () => {
  const course: CourseInput = {
    id: 'course',
    name: '课程',
    capacity: 2,
    competitors: 5,
    value: 1,
    distribution: { type: 'average', points: 12 },
    primeOnly: true,
  };
  const first = optimizeCourses([course], 8, 'sum', 500, 20260903);
  const second = optimizeCourses([course], 8, 'sum', 500, 20260903);

  assert.equal(first.courses[0].method, '指数竞赛模拟 · 质数化 100%');
  assert.deepEqual(first.courses[0].curve, second.courses[0].curve);
});

void test('质数化占比为零时退回基础分布', () => {
  const common = { id: 'course', name: '课程', capacity: 2, competitors: 5, value: 1 };
  const primeCourse: CourseInput = { ...common, distribution: { type: 'average', points: 20 }, primeOnly: true, primeShare: 0 };
  const fixedCourse: CourseInput = { ...common, distribution: { type: 'average', points: 20 } };
  const primeResult = optimizeCourses([primeCourse], 8, 'sum', 500, 42);
  const fixedResult = optimizeCourses([fixedCourse], 8, 'sum', 500, 42);

  assert.equal(primeResult.courses[0].method, '解析公式 · 质数化 0%');
  assert.deepEqual(primeResult.courses[0].curve, fixedResult.courses[0].curve);
});

void test('部分质数化占比进入可复现的混合分布模拟', () => {
  const course: CourseInput = {
    id: 'course',
    name: '课程',
    capacity: 2,
    competitors: 5,
    value: 1,
    distribution: { type: 'average', points: 20 },
    primeOnly: true,
    primeShare: 0.4,
  };
  const first = optimizeCourses([course], 8, 'sum', 500, 20260903);
  const second = optimizeCourses([course], 8, 'sum', 500, 20260903);

  assert.equal(first.courses[0].method, '指数竞赛模拟 · 质数化 40%');
  assert.deepEqual(first.courses[0].curve, second.courses[0].curve);
});

void test('半余弦先验在相对超额一半处给出 49.5 点且离散度达到峰值', () => {
  assert.equal(adaptiveMeanPoints(100, 150, 'cosine'), 49.49999999999999);
  assert.ok(Math.abs(adaptiveSpreadIndex(100, 150, 'cosine') - 1) < 1e-12);
  assert.ok(Math.abs(adaptiveMeanPoints(100, 200, 'cosine') - 99) < 1e-12);
  assert.ok(Math.abs(adaptiveSpreadIndex(100, 200, 'cosine')) < 1e-12);
});

void test('自动均匀分布与正态分布使用同一目标方差', () => {
  const normal = adaptiveDistribution(100, 150, 'cosine', 'normal', DEFAULT_ADAPTIVE_PARAMETERS);
  const uniform = adaptiveDistribution(100, 150, 'cosine', 'uniform', DEFAULT_ADAPTIVE_PARAMETERS);
  assert.equal(normal.type, 'normal');
  assert.equal(uniform.type, 'uniform');
  if (normal.type !== 'normal' || uniform.type !== 'uniform') return;
  const normalSigma = normal.mostWithin / 3;
  const uniformSigma = (uniform.high - uniform.low) / Math.sqrt(12);
  assert.ok(Math.abs(normalSigma - uniformSigma) < 0.5);
});

void test('质数仪式由动态规划直接限制为正质数且不允许 0、1、99', () => {
  const courses: CourseInput[] = [
    { id: 'a', name: '甲', capacity: 2, competitors: 5, value: 1, distribution: { type: 'average', points: 20 } },
    { id: 'b', name: '乙', capacity: 2, competitors: 5, value: 1, distribution: { type: 'average', points: 20 } },
  ];
  const result = optimizeCourses(courses, 7, 'sum', 100, 42, { ownPointPolicy: 'positive-primes' });
  const allowed = new Set<number>(POSITIVE_PRIME_POINT_OPTIONS);
  assert.ok(result.allocations.every((points) => allowed.has(points)));
  assert.ok(result.usedPoints <= 7);
  assert.throws(
    () => optimizeCourses(courses, 3, 'sum', 100, 42, { ownPointPolicy: 'positive-primes' }),
    /无可行解/,
  );
});

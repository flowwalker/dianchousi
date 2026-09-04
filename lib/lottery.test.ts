import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPrimePointRule, type CourseInput, optimizeCourses, primePointCandidates } from './lottery.ts';

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

  assert.equal(primeResult.courses[0].method, '解析公式 · 质数化');
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

  assert.equal(first.courses[0].method, '指数竞赛模拟 · 质数化');
  assert.deepEqual(first.courses[0].curve, second.courses[0].curve);
});

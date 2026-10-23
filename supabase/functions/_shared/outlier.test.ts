import assert from 'node:assert/strict';
import test from 'node:test';
import { isRatioOutlier, median } from './outlier.ts';

const cfo = [49000, 59400, 109000, 61500, 47000, 112000, 55000];

test('median handles odd and even lengths', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('a ~50 reading against a ~50,000 level is an outlier', () => {
  assert.equal(isRatioOutlier(47, cfo), true);
});

test('a reading inside the normal swing is accepted', () => {
  assert.equal(isRatioOutlier(109000, cfo), false);
  assert.equal(isRatioOutlier(25000, cfo), false);
});

test('a spike far above the level is an outlier', () => {
  assert.equal(isRatioOutlier(900000, cfo), true);
});

test('too little history accepts the value', () => {
  assert.equal(isRatioOutlier(47, [50000, 60000, 55000]), false);
});

test('a contaminated minority does not move the median', () => {
  assert.equal(isRatioOutlier(47, [49, 59400, 109000, 56, 61500, 47000, 112000, 55000]), true);
});

test('empty and non-positive readings are left to the empty-supply guard', () => {
  assert.equal(isRatioOutlier(0, cfo), false);
  assert.equal(isRatioOutlier(NaN, cfo), false);
});

import { anomalyDecision } from './outlier.ts';

// NewsAPI normalized readings before and after its real drop on 2026-10-13.
const before = [67, 69, 70, 72, 70, 69, 72, 70];

test('a reading inside 3 sd is accepted', () => {
  assert.equal(anomalyDecision(68, before).action, 'accept');
});

test('a first reading at a new level is held, not dropped', () => {
  const d = anomalyDecision(54, before);
  assert.equal(d.action, 'hold');
});

test('the next reading at the held level confirms the change (the v1 guard rejected it for nine days)', () => {
  assert.equal(anomalyDecision(52, before, 54).action, 'confirm');
});

test('a one-off spike is not confirmed by a return to the old level (negative control)', () => {
  assert.equal(anomalyDecision(70, before, 20).action, 'accept');
  assert.equal(anomalyDecision(20, before, null).action, 'hold');
  assert.equal(anomalyDecision(95, before, 20).action, 'hold', 'a second, different outlier does not confirm the first');
});

test('too little history or variance accepts, as v1 did', () => {
  assert.equal(anomalyDecision(10, [70, 71]).action, 'accept');
  assert.equal(anomalyDecision(10, [70, 70, 70, 70]).action, 'accept');
});

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

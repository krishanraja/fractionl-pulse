import assert from 'node:assert/strict';
import test from 'node:test';
import { V2_SOURCES } from './fwi-method.ts';
import { FRACTIONAL_WORK, TRIALS, logScale } from './trials.ts';

test('no trial is a composite input or a held-out anchor', () => {
  const anchors = ['bls', 'fred', 'census_acs', 'sec_exec_transitions'];
  for (const t of TRIALS) {
    assert.equal(t.source in V2_SOURCES, false, t.source);
    assert.equal(anchors.includes(t.source), false, t.source);
    assert.ok(t.source.startsWith('trial_'));
  }
});

test('log scale: 0 is 0, the anchor is 100, and it never exceeds the bounds', () => {
  assert.equal(logScale(0, 200), 0);
  assert.equal(logScale(200, 200), 100);
  assert.equal(logScale(5000, 200), 100);
  assert.equal(logScale(-3, 200), 0);
  assert.ok(logScale(10, 200) > logScale(9, 200), 'a cap at 10 would show here as movement stopping, not as a fixed value');
});

test('the Podchaser relevance filter keeps fractional-work shows and drops the fuzzy matches (2026-10-23 sample)', () => {
  for (const t of ['The Fractional CTO Podcast', 'Fractional Leaders', 'Diary of a fractional executive', 'Own the P&L: a fractional CFO on margins']) assert.ok(FRACTIONAL_WORK.test(t), t);
  for (const t of ['Sex, Death & Olive Oil', 'AI and Autism', 'The Fractional Dad', 'fractional ownership of jets']) assert.equal(FRACTIONAL_WORK.test(t), false, t);
});

import { trailingZScore } from './trials.ts';

test('Trends rescored on its own history moves where the floored normalizer could not', () => {
  const trailing = [3.4, 2.6, 2.7, 3.4, 3.2, 4.2, 3.5, 3.4, 2.6, 3.7];
  const low = trailingZScore(2.6, trailing), high = trailingZScore(5.3, trailing);
  assert.ok(low != null && high != null && high > low, `${low} vs ${high}`);
  assert.equal(trailingZScore(3.0, [3, 3, 3, 3, 3, 3, 3]), null, 'a constant history gives no score, not a fake 50');
  assert.equal(trailingZScore(3.0, [3, 4]), null, 'too little history gives no score');
});

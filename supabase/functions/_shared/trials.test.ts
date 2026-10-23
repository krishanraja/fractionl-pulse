import assert from 'node:assert/strict';
import test from 'node:test';
import { V2_SOURCES } from './fwi-method.ts';
import { TRIALS, logScale, plausibleFlow } from './trials.ts';

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

test('a weekly flow must move forward by a plausible amount', () => {
  const prior = [35, 36, 38, 46, 54, 50];
  assert.equal(plausibleFlow(51, prior), true);
  assert.equal(plausibleFlow(-588, prior), false, 'July 2026 index rebuild');
  assert.equal(plausibleFlow(475, prior), false, 'the rebound after it');
  assert.equal(plausibleFlow(0, prior), true);
});

import { trailingZScore } from './trials.ts';

test('Trends rescored on its own history moves where the floored normalizer could not', () => {
  const trailing = [3.4, 2.6, 2.7, 3.4, 3.2, 4.2, 3.5, 3.4, 2.6, 3.7];
  const low = trailingZScore(2.6, trailing), high = trailingZScore(5.3, trailing);
  assert.ok(low != null && high != null && high > low, `${low} vs ${high}`);
  assert.equal(trailingZScore(3.0, [3, 3, 3, 3, 3, 3, 3]), null, 'a constant history gives no score, not a fake 50');
  assert.equal(trailingZScore(3.0, [3, 4]), null, 'too little history gives no score');
});

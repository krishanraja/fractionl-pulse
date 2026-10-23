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

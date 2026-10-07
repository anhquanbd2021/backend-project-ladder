import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER } from '../public/ladder.mjs';
import { simulate, simulateRung } from '../public/sims.mjs';

test('every rung maps to a distinct simulation', () => {
  const simIds = LADDER.map(r => r.sim);
  assert.equal(new Set(simIds).size, LADDER.length);
  for (const r of LADDER) {
    assert.doesNotThrow(() => simulate(r.sim, 'with'));
  }
});

test('core invariant: without the concept every rung fails, with it every rung holds', () => {
  for (const r of LADDER) {
    const wo = simulateRung(r, 'without');
    const w = simulateRung(r, 'with');
    assert.equal(wo.outcome, 'failed', `${r.id} without`);
    assert.equal(w.outcome, 'ok', `${r.id} with`);
    assert.ok(wo.steps.length >= 2, `${r.id} without has steps`);
    assert.ok(w.steps.length >= 2, `${r.id} with has steps`);
  }
});

test('restart sim: persistence prevents record loss', () => {
  assert.equal(simulate('restart', 'without').metrics.recordsLost, 3);
  assert.equal(simulate('restart', 'with').metrics.recordsLost, 0);
});

test('collision sim: naive keys overwrite and enumerate', () => {
  const wo = simulate('collision', 'without');
  assert.equal(wo.metrics.overwrites, 1);
  assert.equal(wo.metrics.enumerable, true);
  const w = simulate('collision', 'with');
  assert.equal(w.metrics.overwrites, 0);
  assert.equal(w.metrics.enumerable, false);
});

test('burst sim: the limiter sheds load instead of queueing it', () => {
  const wo = simulate('burst', 'without');
  assert.equal(wo.metrics.shed, 0);
  assert.ok(wo.metrics.queuePeak > 0);
  const w = simulate('burst', 'with');
  assert.ok(w.metrics.shed > 0);
  assert.ok(w.metrics.queuePeak < wo.metrics.queuePeak);
});

test('blocking sim: retry double-executes without an idempotent queue', () => {
  assert.equal(simulate('blocking', 'without').metrics.executions, 2);
  assert.equal(simulate('blocking', 'with').metrics.executions, 1);
});

test('slow-consumer sim: one client stalls the room without buffers', () => {
  const wo = simulate('slow-consumer', 'without');
  assert.ok(wo.metrics.stalledClients > 0);
  const w = simulate('slow-consumer', 'with');
  assert.equal(w.metrics.stalledClients, 0);
  assert.equal(w.metrics.dropped, 1);
});

test('policy sim: per-service auth drifts into a hole', () => {
  assert.equal(simulate('policy', 'without').metrics.gaps, 1);
  assert.equal(simulate('policy', 'with').metrics.gaps, 0);
});

test('node-loss sim: replication keeps the keys', () => {
  assert.ok(simulate('node-loss', 'without').metrics.keysLost > 0);
  assert.equal(simulate('node-loss', 'with').metrics.keysLost, 0);
});

test('sims are deterministic', () => {
  for (const r of LADDER) {
    assert.deepEqual(simulate(r.sim, 'without'), simulate(r.sim, 'without'));
  }
});

test('unknown sim id throws', () => {
  assert.throws(() => simulate('nope', 'with'), /unknown sim/);
});

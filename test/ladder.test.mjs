import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  LADDER, rungById, validateLadder, unlockedRungs, nextRung,
  auditPath, conceptsFor,
} from '../public/ladder.mjs';
import { EXAMPLE_IN_ORDER, EXAMPLE_SKIP_RUNGS } from '../public/examples.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('ladder has 7 sequential rungs with unique ids and concepts', () => {
  assert.equal(LADDER.length, 7);
  assert.deepEqual(LADDER.map(r => r.rung), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(LADDER.map(r => r.id)).size, 7);
  assert.equal(new Set(LADDER.map(r => r.conceptKey)).size, 7);
});

test('ladder ordering is valid: every requires comes from an earlier rung', () => {
  const v = validateLadder(LADDER);
  assert.equal(v.ok, true, v.errors.join('; '));
});

test('reordering the ladder breaks validation', () => {
  const broken = [LADDER[6], ...LADDER.slice(0, 6)];
  const v = validateLadder(broken);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.includes('distributed-kv')));
});

test('a requires entry with no provider fails validation', () => {
  const broken = LADDER.map(r => ({ ...r }));
  broken[2] = { ...broken[2], requires: ['nonexistent-concept'] };
  assert.equal(validateLadder(broken).ok, false);
});

test('unlockedRungs: empty path unlocks only rung 1', () => {
  assert.deepEqual(unlockedRungs([]).map(r => r.id), ['crud-api']);
});

test('after rung 1, the three persistence-dependent rungs unlock', () => {
  const ids = unlockedRungs(['crud-api']).map(r => r.id).sort();
  assert.deepEqual(ids, ['job-queue', 'rate-limiter', 'url-shortener']);
});

test('chat server stays locked until the job-queue rung is done', () => {
  assert.ok(!unlockedRungs(['crud-api', 'url-shortener']).some(r => r.id === 'chat-server'));
  assert.ok(unlockedRungs(['crud-api', 'job-queue']).some(r => r.id === 'chat-server'));
});

test('nextRung returns the lowest unlocked uncompleted rung', () => {
  assert.equal(nextRung([]).id, 'crud-api');
  assert.equal(nextRung(['crud-api', 'url-shortener']).id, 'rate-limiter');
  assert.equal(nextRung(LADDER.map(r => r.id)), null);
});

test('auditPath: in-order fixture audits clean and complete', () => {
  const a = auditPath(EXAMPLE_IN_ORDER.completed);
  assert.equal(a.clean, true);
  assert.equal(a.complete, true);
  assert.equal(a.next, null);
});

test('auditPath: skip-rungs fixture flags the missing lessons', () => {
  const a = auditPath(EXAMPLE_SKIP_RUNGS.completed);
  assert.equal(a.clean, false);
  const chat = a.gaps.find(g => g.rung === 'chat-server');
  assert.ok(chat.missing.includes('async-processing'));
  assert.ok(chat.missingRungs.includes('job-queue'));
  // distributed-kv: persistence (have it) + concurrency (chat supplies it)
  // but storage-design was skipped with the URL shortener
  const kv = a.gaps.find(g => g.rung === 'distributed-kv');
  assert.ok(kv.missing.includes('storage-design'));
  assert.ok(kv.missingRungs.includes('url-shortener'));
});

test('embedded examples match files on disk', async () => {
  const io = JSON.parse(await readFile(`${root}examples/in-order.json`, 'utf8'));
  const sr = JSON.parse(await readFile(`${root}examples/skip-rungs.json`, 'utf8'));
  assert.deepEqual(EXAMPLE_IN_ORDER, io);
  assert.deepEqual(EXAMPLE_SKIP_RUNGS, sr);
});

test('auditPath flags an unknown rung id instead of crashing', () => {
  const a = auditPath(['crud-api', 'moon-landing']);
  const g = a.gaps.find(x => x.rung === 'moon-landing');
  assert.ok(g.missing.includes('unknown rung id'));
});

test('conceptsFor collects concept keys of completed rungs', () => {
  const c = conceptsFor(['crud-api', 'rate-limiter']);
  assert.ok(c.has('persistence') && c.has('admission-control'));
  assert.ok(!c.has('replication'));
});

// Backend Ladder Lab — ladder data + ordering/audit engine.
// Pure module: no I/O, no DOM. Shared by the browser UI, the CLI, and tests.

export const LADDER = [
  {
    id: 'crud-api',
    rung: 1,
    project: 'CRUD API',
    concept: 'Persistence',
    conceptKey: 'persistence',
    sim: 'restart',
    requires: [],
    teaches:
      'State must outlive the process. A real database, migrations, and connection handling — the app is a guest, the data is the product.',
    failureWithout:
      'State kept in a process-local object survives until the first restart — then every record vanishes.',
  },
  {
    id: 'url-shortener',
    rung: 2,
    project: 'URL shortener',
    concept: 'Storage design',
    conceptKey: 'storage-design',
    sim: 'collision',
    requires: ['persistence'],
    teaches:
      'Key generation is a design problem: collision handling, and the difference between unique and unguessable.',
    failureWithout:
      'Sequential IDs are enumerable — anyone can walk every link. Truncated hashes collide and silently overwrite.',
  },
  {
    id: 'rate-limiter',
    rung: 3,
    project: 'Rate limiter',
    concept: 'Admission control',
    conceptKey: 'admission-control',
    sim: 'burst',
    requires: ['persistence'],
    teaches:
      'Shedding load is a feature. Per-client caps need shared, durable counters — which is why this sits above persistence.',
    failureWithout:
      'One retrying client is indistinguishable from a traffic spike; the work queue outgrows the workers and everyone waits.',
  },
  {
    id: 'job-queue',
    rung: 4,
    project: 'Job queue',
    concept: 'Asynchronous work',
    conceptKey: 'async-processing',
    sim: 'blocking',
    requires: ['persistence'],
    teaches:
      'Accept work with 202, drain it with workers. Idempotency keys make the inevitable retry a no-op instead of a double-charge.',
    failureWithout:
      'Slow work holds connections open; clients time out, retry, and the same job executes twice.',
  },
  {
    id: 'chat-server',
    rung: 5,
    project: 'Chat server',
    concept: 'Concurrency & backpressure',
    conceptKey: 'concurrency',
    sim: 'slow-consumer',
    requires: ['async-processing'],
    teaches:
      'Concurrency is many connections failing independently. Per-client buffers and drop-or-disconnect policies isolate the slow consumer.',
    failureWithout:
      'One slow socket stalls the broadcast loop — one dead phone on hotel Wi-Fi freezes the room for everyone.',
  },
  {
    id: 'api-gateway',
    rung: 6,
    project: 'API gateway',
    concept: 'Cross-cutting policy',
    conceptKey: 'edge-policy',
    sim: 'policy',
    requires: ['admission-control'],
    teaches:
      'Auth and rate limits are cross-cutting: one enforcement point beats N inconsistent copies — admission control applied to architecture.',
    failureWithout:
      'Each service reimplements auth differently; one forgets expiry checks and the perimeter has a hole.',
  },
  {
    id: 'distributed-kv',
    rung: 7,
    project: 'Distributed KV store',
    concept: 'Replication',
    conceptKey: 'replication',
    sim: 'node-loss',
    requires: ['persistence', 'concurrency', 'storage-design'],
    teaches:
      'Replication buys survival and pays for it with consistency — the capstone that consumes every rung below.',
    failureWithout:
      'One node dies and its keys vanish with it; add a replica and two writers make "the value" a question, not a fact.',
  },
];

const byId = new Map(LADDER.map(r => [r.id, r]));

export function rungById(id) {
  return byId.get(id) || null;
}

// Provider index: conceptKey -> rung that introduces it.
export function conceptProviders(ladder = LADDER) {
  const map = new Map();
  for (const r of ladder) map.set(r.conceptKey, r);
  return map;
}

// Validate the ladder ordering: ids unique, rungs sequential from 1,
// every `requires` concept introduced by a strictly earlier rung.
export function validateLadder(ladder = LADDER) {
  const errors = [];
  const seenIds = new Set();
  const seenConcepts = new Set();
  ladder.forEach((r, i) => {
    if (r.rung !== i + 1) errors.push(`${r.id}: rung ${r.rung} out of sequence (expected ${i + 1})`);
    if (seenIds.has(r.id)) errors.push(`${r.id}: duplicate id`);
    if (seenConcepts.has(r.conceptKey)) errors.push(`${r.id}: duplicate conceptKey ${r.conceptKey}`);
    for (const need of r.requires || []) {
      if (!seenConcepts.has(need)) {
        errors.push(`${r.id} requires "${need}" which no earlier rung introduces`);
      }
    }
    seenIds.add(r.id);
    seenConcepts.add(r.conceptKey);
  });
  return { ok: errors.length === 0, errors };
}

// Concepts a set of completed rung ids provides.
export function conceptsFor(completedIds, ladder = LADDER) {
  const concepts = new Set();
  for (const id of completedIds) {
    const r = ladder.find(x => x.id === id);
    if (r) concepts.add(r.conceptKey);
  }
  return concepts;
}

// Rungs whose prerequisites are all satisfied by completed rungs.
export function unlockedRungs(completedIds, ladder = LADDER) {
  const have = conceptsFor(completedIds, ladder);
  return ladder.filter(
    r => !completedIds.includes(r.id) && (r.requires || []).every(need => have.has(need)),
  );
}

// Lowest-rung uncompleted build with all prerequisites met — "what to build next".
export function nextRung(completedIds, ladder = LADDER) {
  return unlockedRungs(completedIds, ladder)[0] || null;
}

// Audit a learner's path: for every completed rung, which required concepts
// are NOT provided by other completed rungs — the skipped lessons.
export function auditPath(completedIds, ladder = LADDER) {
  const providers = conceptProviders(ladder);
  const done = new Set(completedIds);
  const have = conceptsFor(completedIds, ladder);
  const gaps = [];
  for (const id of completedIds) {
    const r = byId.get(id) || ladder.find(x => x.id === id);
    if (!r) {
      gaps.push({ rung: id, missing: ['unknown rung id'], missingRungs: [] });
      continue;
    }
    const missing = (r.requires || []).filter(need => !have.has(need));
    gaps.push({
      rung: r.id,
      project: r.project,
      missing,
      missingRungs: missing.map(need => providers.get(need)?.id || need),
    });
  }
  const clean = gaps.every(g => g.missing.length === 0);
  const doneSet = done;
  const next = nextRung(completedIds, ladder);
  return {
    completed: completedIds,
    complete: ladder.every(r => doneSet.has(r.id)),
    clean,
    gaps,
    next: next ? next.id : null,
  };
}

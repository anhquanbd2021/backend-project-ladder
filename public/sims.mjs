// Backend Ladder Lab — per-rung failure simulations.
// Pure, deterministic models. Each sim returns the same shape:
//   { rung, mode: 'with'|'without', steps: [{label, events:[...]}],
//     outcome: 'ok'|'failed', summary, metrics }
// Invariant asserted by tests: 'without' always ends 'failed',
// 'with' always ends 'ok' — every rung's concept prevents one failure.

const SIMS = {
  // Rung 1 — CRUD API — persistence
  restart(withMode) {
    const store = withMode ? 'database' : 'in-memory object';
    const steps = [
      { label: 'Clients write records', events: [`3 records written to the ${store}`] },
      { label: 'Deploy ships — process restarts', events: ['process exits', 'new process boots'] },
    ];
    if (withMode) {
      steps.push(
        { label: 'First read after restart', events: ['SELECT returns all 3 records'] },
        { label: 'Result', events: ['state outlived the process — persistence held'] },
      );
      return { steps, outcome: 'ok', summary: 'Data survives the restart.', metrics: { recordsLost: 0 } };
    }
    steps.push(
      { label: 'First read after restart', events: ['memory is empty — all 3 records gone'] },
      { label: 'Result', events: ['deploy "deleted" the data; clients see 404s'] },
    );
    return { steps, outcome: 'failed', summary: 'Restart wiped every record.', metrics: { recordsLost: 3 } };
  },

  // Rung 2 — URL shortener — storage design
  collision(withMode) {
    const steps = [
      { label: 'Two clients shorten different URLs', events: ['client A: /a/long/url', 'client B: /b/other/url'] },
    ];
    if (withMode) {
      steps.push(
        { label: 'Random key + uniqueness check', events: ['A → k8f3qz (stored)', 'B candidate collides → re-generated → x2m9pl (stored)'] },
        { label: 'Result', events: ['both mappings coexist; keys are unguessable'] },
      );
      return { steps, outcome: 'ok', summary: 'Collision detected, key regenerated.', metrics: { overwrites: 0, enumerable: false } };
    }
    steps.push(
      { label: 'Sequential IDs as keys', events: ['A → /1', 'B → /2', 'anyone can GET /1../2 — the whole table is enumerable'] },
      { label: 'Truncated-hash variant', events: ['hash(A)[:6] = ab12cd', 'hash(B)[:6] = ab12cd → B overwrites A silently'] },
      { label: 'Result', events: ['/ab12cd now serves the wrong destination; /1../N leak every link'] },
    );
    return { steps, outcome: 'failed', summary: 'Enumerable IDs + silent overwrite.', metrics: { overwrites: 1, enumerable: true } };
  },

  // Rung 3 — rate limiter — admission control
  burst(withMode) {
    const REQUESTS = 12, CAPACITY = 4;
    const steps = [
      { label: 'Burst arrives', events: [`${REQUESTS} requests in 200 ms`, `worker capacity: ${CAPACITY}`] },
    ];
    if (withMode) {
      const admitted = 5, shed = REQUESTS - admitted;
      steps.push(
        { label: 'Token bucket evaluates each request', events: [`${admitted} admitted`, `${shed} rejected with 429`] },
        { label: 'Result', events: [`queue depth stays at ${admitted - CAPACITY}`, 'latency flat for admitted requests; shed clients retry later'] },
      );
      return { steps, outcome: 'ok', summary: `Shed ${shed} requests, served the rest on time.`, metrics: { admitted, shed, queuePeak: 1 } };
    }
    steps.push(
      { label: 'Every request accepted', events: [`queue depth grows to ${REQUESTS - CAPACITY}`, 'workers saturated'] },
      { label: 'Result', events: ['tail latency x8 — every client waits, the burst starves the baseline traffic'] },
    );
    return { steps, outcome: 'failed', summary: 'Queue exploded; all clients degraded.', metrics: { admitted: REQUESTS, shed: 0, queuePeak: REQUESTS - CAPACITY } };
  },

  // Rung 4 — job queue — async work + idempotency
  blocking(withMode) {
    const steps = [
      { label: 'Client submits a 30 s report job', events: ['POST /reports (slow work)'] },
    ];
    if (withMode) {
      steps.push(
        { label: 'Enqueue + return', events: ['job record written with idempotency key job-42', '202 Accepted in 12 ms'] },
        { label: 'Worker drains the queue', events: ['job-42 → pending → done (executed once)'] },
        { label: 'Client retries anyway', events: ['same key job-42 → already done → no-op'] },
        { label: 'Result', events: ['job ran exactly once despite the retry'] },
      );
      return { steps, outcome: 'ok', summary: 'One execution, retry was a no-op.', metrics: { executions: 1, blockedMs: 12 } };
    }
    steps.push(
      { label: 'Request runs the job inline', events: ['connection held open', 't+10 s: client times out'] },
      { label: 'Client retries', events: ['second request starts the same job again'] },
      { label: 'Result', events: ['job executes twice — a charge or an email is sent 2x'] },
    );
    return { steps, outcome: 'failed', summary: 'Timeout retry double-executed the job.', metrics: { executions: 2, blockedMs: 30000 } };
  },

  // Rung 5 — chat server — concurrency & backpressure
  'slow-consumer'(withMode) {
    const steps = [
      { label: 'Room of 4 clients, message broadcast', events: ['send → c1, c2, c3, c4'] },
      { label: 'c4 is on a dead connection', events: ['write to c4 buffers, does not drain'] },
    ];
    if (withMode) {
      steps.push(
        { label: 'Per-client buffer policy', events: ['c4 buffer crosses limit → disconnect c4', 'c1–c3 unaffected'] },
        { label: 'Result', events: ['room keeps flowing; one client sacrificed, not all'] },
      );
      return { steps, outcome: 'ok', summary: 'Slow consumer isolated and dropped.', metrics: { stalledClients: 0, dropped: 1 } };
    }
    steps.push(
      { label: 'Broadcast waits on c4', events: ['single write loop blocks behind c4\'s buffer', 'c1–c3 see nothing new'] },
      { label: 'Result', events: ['one dead phone freezes the whole room'] },
    );
    return { steps, outcome: 'failed', summary: 'One slow client stalled everyone.', metrics: { stalledClients: 3, dropped: 0 } };
  },

  // Rung 6 — API gateway — cross-cutting policy
  policy(withMode) {
    const services = ['users', 'orders', 'billing'];
    const steps = [
      { label: 'Request needs auth + rate limit', events: [`fan-out to ${services.join(', ')}`] },
    ];
    if (withMode) {
      steps.push(
        { label: 'Gateway enforces once at the edge', events: ['token validated', 'rate limit applied', 'valid request routed'] },
        { label: 'Result', events: ['policy identical for every service — one place to fix'] },
      );
      return { steps, outcome: 'ok', summary: 'One enforcement point, zero drift.', metrics: { enforced: 3, gaps: 0 } };
    }
    steps.push(
      { label: 'Each service reimplements auth', events: ['users: validates + expiry', 'orders: validates + expiry', 'billing: validates signature, skips expiry'] },
      { label: 'Result', events: ['expired token accepted by billing — the perimeter has a hole'] },
    );
    return { steps, outcome: 'failed', summary: 'Policy drifted; billing skips expiry.', metrics: { enforced: 2, gaps: 1 } };
  },

  // Rung 7 — distributed KV — replication
  'node-loss'(withMode) {
    const steps = [
      { label: 'Two nodes hold keys', events: ['n1: k1,k2', 'n2: k3,k4'] },
      { label: 'n1 dies', events: ['node n1 unreachable'] },
    ];
    if (withMode) {
      steps.push(
        { label: 'Replica holds a copy', events: ['n2 replica serves k1,k2', 'reads continue'] },
        { label: 'Result', events: ['no keys lost — but concurrent writers now need conflict rules'] },
      );
      return { steps, outcome: 'ok', summary: 'Replica survived the node loss.', metrics: { keysLost: 0 } };
    }
    steps.push(
      { label: 'No replica', events: ['k1,k2 existed only on n1'] },
      { label: 'Result', events: ['half the keyspace is gone with the node'] },
    );
    return { steps, outcome: 'failed', summary: 'Node death took its keys with it.', metrics: { keysLost: 2 } };
  },
};

export function simulate(simId, mode /* 'with' | 'without' */) {
  const fn = SIMS[simId];
  if (!fn) throw new Error(`unknown sim: ${simId}`);
  const r = fn(mode === 'with');
  return { sim: simId, mode, ...r };
}

export function simulateRung(rung, mode) {
  const result = simulate(rung.sim, mode);
  return { rung: rung.id, project: rung.project, concept: rung.concept, ...result };
}

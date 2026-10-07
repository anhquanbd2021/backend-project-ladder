// Embedded copies of examples/*.json so the browser lab can load fixtures
// without a fetch round-trip. Tests assert these match the files on disk.

export const EXAMPLE_IN_ORDER = {
  name: 'In order',
  note: 'The full climb — every rung completed in sequence.',
  completed: [
    'crud-api',
    'url-shortener',
    'rate-limiter',
    'job-queue',
    'chat-server',
    'api-gateway',
    'distributed-kv',
  ],
};

export const EXAMPLE_SKIP_RUNGS = {
  name: 'Skip rungs',
  note: 'Jumped straight to the shiny projects — the audit flags the skipped lessons.',
  completed: ['crud-api', 'chat-server', 'distributed-kv'],
};

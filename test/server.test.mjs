import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../app/server.js';

async function withServer(fn) {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('allowlist serves the lab and modules, 404s everything else', async () => {
  await withServer(async base => {
    for (const path of ['/', '/guide.html', '/styles.css', '/app.js', '/ladder.mjs', '/sims.mjs', '/examples.mjs']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
    }
    for (const path of ['/package.json', '/../package.json', '/server.js', '/nope']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 404, path);
    }
  });
});

test('/health is ok and /version returns package metadata', async () => {
  await withServer(async base => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'ok');
    const version = await fetch(`${base}/version`);
    const body = await version.json();
    assert.equal(body.name, 'backend-project-ladder-demo');
    assert.ok(body.version);
    // security headers present
    assert.equal(version.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(version.headers.get('content-security-policy').includes("default-src 'self'"));
  });
});

// D1 sync route: push/pull, deletes, paging, isolation, validation, hashed codes, server delete.
// Uses node:sqlite as a stand-in for D1. Run: node tests/sync.test.mjs
import assert from 'node:assert/strict';
import { loadWorker, suite, fakeD1 } from './helpers.mjs';

const worker = (await loadWorker()).__default;
const { test, done } = suite('sync');

const env = { GEMINI_API_KEY: 'x', ALLOWED_ORIGIN: 'https://app', DB: fakeD1() };
const call = async (p, body, h = {}) => {
  const r = await worker.fetch(new Request('https://w' + p, { method: 'POST', headers: { Origin: 'https://app', ...h }, body: JSON.stringify(body) }), env);
  return [r.status, await r.json()];
};
const code = 'ABCDEFGHJKLMNPQRSTUV', A = crypto.randomUUID(), B = crypto.randomUUID();

await test('device A uploads rows', async () => {
  const [st, r] = await call('/sync', { code, device: A, cursor: 0, rows: [{ k: 'm:1', d: '{"a":1}' }, { k: 'w:2', d: '"x"' }] });
  assert.equal(st, 200); assert.equal(r.rows.length, 0); assert.equal(r.cursor, 2);
});
await test('device B pulls them', async () => {
  const [, r] = await call('/sync', { code, device: B, cursor: 0, rows: [] });
  assert.deepEqual(r.rows.map((x) => x.k), ['m:1', 'w:2']); assert.equal(r.cursor, 2);
});
await test('a delete from B reaches A', async () => {
  let [, r] = await call('/sync', { code, device: B, cursor: 2, rows: [{ k: 'm:1', d: null }] });
  assert.equal(r.cursor, 3);
  [, r] = await call('/sync', { code, device: A, cursor: 2, rows: [] });
  assert.deepEqual(r.rows, [{ k: 'm:1', d: null }]);
});
await test('750 rows arrive in 2 pages', async () => {
  for (let i = 0; i < 3; i++) await call('/sync', { code, device: A, cursor: 3, rows: Array.from({ length: 250 }, (_, j) => ({ k: `c:${i}-${j}`, d: '"m"' })) });
  let cur = 3, got = 0, more = true, pages = 0;
  while (more) { const [, r] = await call('/sync', { code, device: B, cursor: cur, rows: [] }); got += r.rows.length; cur = r.cursor; more = r.more; pages++; }
  assert.equal(got, 750); assert.equal(pages, 2);
});
await test('another code sees nothing', async () => {
  const [, r] = await call('/sync', { code: 'ZZZZZZZZZZZZZZZZZZZZ', device: B, cursor: 0, rows: [] });
  assert.equal(r.rows.length, 0); assert.equal(r.rev, 0);
});
await test('bad input is rejected', async () => {
  assert.equal((await call('/sync', { code: 'short', device: A, rows: [] }))[0], 400);
  assert.equal((await call('/sync', { code, device: 'not-a-uuid', rows: [] }))[0], 400);
  assert.equal((await call('/sync', { code, device: A, rows: [{ k: 'bad key!', d: '1' }] }))[0], 400);
  assert.equal((await call('/sync', { code, device: A, rows: [{ k: 'm:1', d: 'x'.repeat(20001) }] }))[0], 400);
  assert.equal((await call('/sync', { code, device: A, rows: Array(301).fill({ k: 'm:1', d: '1' }) }))[0], 413);
  assert.equal((await call('/sync', { code, device: A, rows: [] }, { Origin: 'https://evil' }))[0], 403);
});
await test('the sync code is stored only as a SHA-256 hash', async () => {
  const accs = env.DB.raw.prepare('SELECT id FROM accounts').all();
  assert.ok(accs.length && accs.every((a) => /^[0-9a-f]{64}$/.test(a.id) && a.id !== code));
});
await test('server delete → rev 0 (the app restarts its sync)', async () => {
  await call('/sync/delete', { code });
  const [, r] = await call('/sync', { code, device: A, cursor: 1003, rows: [] });
  assert.equal(r.rev, 0);
});

done();

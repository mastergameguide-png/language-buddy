// Shared helpers for the offline tests (Node 22.5+, no npm packages).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORKER_PATH = path.join(ROOT, 'worker', 'worker.js');

// check(name, ok, detail) prints PASS/FAIL; done() prints the total and sets the exit code.
export function suite(title) {
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    if (ok) pass++; else fail++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || detail === '' ? '' : ' | ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))));
  };
  const test = async (name, fn) => {
    try { await fn(); check(name, true); } catch (e) { check(name, false, e.message); }
  };
  return {
    check,
    test,
    done() {
      console.log(`\n${title}: ${pass} passed, ${fail} failed`);
      process.exitCode = fail ? 1 : 0;
    },
  };
}

// The Worker only exports its default handler. Tests also need some inner functions, so a copy
// with extra named exports is written to the temp folder and imported from there.
export async function loadWorker(names = []) {
  const src = fs.readFileSync(WORKER_PATH, 'utf8').replace('export default {', 'const __default = {')
    + `\nexport { ${['__default', ...names].join(', ')} };\n`;
  const tmp = path.join(os.tmpdir(), `lb-worker-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, src);
  try { return await import(pathToFileURL(tmp).href); } finally { fs.rmSync(tmp, { force: true }); }
}

// Minimal Cloudflare D1 stand-in on node:sqlite: prepare / bind / batch (one transaction).
export function fakeD1(schemaPath = path.join(ROOT, 'worker', 'schema.sql')) {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  const mk = (sql, args = []) => ({
    sql, args,
    bind: (...a) => mk(sql, a),
    run() { return /^\s*select/i.test(sql) ? { results: db.prepare(sql).all(...args) } : (db.prepare(sql).run(...args), { results: [] }); },
  });
  return {
    prepare: (sql) => mk(sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map((s) => s.run()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    raw: db,
  };
}

// Fake KV namespace for the push routes.
export function fakeKV() {
  const m = new Map();
  return {
    async get(k, type) { const v = m.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
    map: m,
  };
}

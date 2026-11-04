// Runs every offline test file (no network, no AI quota) and prints one summary.
// Run: node tests/run-all.mjs        (the live AI test is separate: node tests/live-characters.mjs)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(dir, f)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter((l) => /^FAIL|Error/.test(l));
  const last = out.trim().split('\n').pop();
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${f.padEnd(28)} ${last}`);
  if (r.status !== 0) { failed++; for (const l of fails.slice(0, 10)) console.log('     ' + l); }
}
console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exitCode = failed ? 1 : 0;

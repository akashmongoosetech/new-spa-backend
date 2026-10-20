/**
 * Parse-check every JavaScript module in the backend without executing it.
 * Used by `npm run check` and CI as a fast guard against syntax errors.
 */
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';

const root = resolve(process.cwd());
const targets = ['src', 'scripts', 'test'];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) files.push(full);
  }
}

for (const target of targets) {
  try {
    walk(join(root, target));
  } catch {
    // Optional folder (e.g. tests) may not exist in trimmed deployments.
  }
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`Syntax check failed: ${file}`);
  }
}

console.log(`Checked ${files.length} file(s); ${failed} failure(s).`);
process.exit(failed === 0 ? 0 : 1);

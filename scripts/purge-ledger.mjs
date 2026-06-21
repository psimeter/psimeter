#!/usr/bin/env node
/**
 * Wipe all LOCAL DEV ledger output under `ledger/` except the tracked `.gitkeep`.
 *
 * This is dev/test-run data only — git-ignored and regenerated on the next run
 * (the server writes a fresh genesis on start). It is NEVER the published,
 * externally-anchored dataset (docs/SPECIFICATION.md §7). This is an active
 * development project: purge as often as you adjust things, so no stale run data
 * ever lingers to shape the code around it.
 *
 *   npm run purge
 */
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerDir = join(repoRoot, 'ledger');

let entries;
try {
  entries = readdirSync(ledgerDir);
} catch {
  console.log('ledger/ does not exist — nothing to purge.');
  process.exit(0);
}

let removed = 0;
for (const name of entries) {
  if (name === '.gitkeep') continue;
  rmSync(join(ledgerDir, name), { recursive: true, force: true });
  console.log(`  removed ledger/${name}`);
  removed += 1;
}
console.log(removed === 0 ? 'ledger/ already clean (only .gitkeep).' : `Purged ${removed} item(s) from ledger/ (kept .gitkeep).`);

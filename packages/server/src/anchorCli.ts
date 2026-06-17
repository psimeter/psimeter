/**
 * `npm run anchor` — append an external-anchor entry for the current ledger head,
 * emit a publishable receipt, and (by default) submit the head hash to
 * OpenTimestamps, writing a detached `.ots` proof to upgrade/verify later with the
 * standard OpenTimestamps tools (spec D2, §7.6). Set PSYMETER_OTS=0 to skip the
 * network submission and just emit the receipt.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LedgerStore } from './ledgerStore.js';
import { anchorHead } from './anchor.js';
import { buildOtsProof, sha256Bytes, stampHashViaOpenTimestamps } from './opentimestamps.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ledgerPath = resolve(repoRoot, process.env.PSYMETER_LEDGER ?? 'ledger/dev.jsonl');
const receiptsPath = resolve(dirname(ledgerPath), 'anchor-receipts.jsonl');

const store = new LedgerStore(ledgerPath);
const r = anchorHead(store, receiptsPath);

// eslint-disable-next-line no-console
console.log(`anchored ledger head:\n  ${r.headHash}\n  at ${r.anchoredAt}`);
console.log(`receipt appended to ${receiptsPath}`);

if (process.env.PSYMETER_OTS === '0') {
  console.log('\nOpenTimestamps submission skipped (PSYMETER_OTS=0). Publish the head hash manually (D2).');
} else {
  try {
    // Stamp a small file whose content IS the head hash, so the proof pairs with a
    // concrete artifact that `ots verify` can re-hash.
    const anchorsDir = resolve(dirname(ledgerPath), 'anchors');
    mkdirSync(anchorsDir, { recursive: true });
    const content = new TextEncoder().encode(`${r.headHash}\n`);
    const message = sha256Bytes(content);
    const calendarTimestamp = await stampHashViaOpenTimestamps(message);
    const proof = buildOtsProof(message, calendarTimestamp);

    const head8 = r.headHash.split(':')[1]!.slice(0, 8);
    const file = resolve(anchorsDir, `${r.anchoredAt.replace(/[:.]/g, '-')}-${head8}.headhash`);
    writeFileSync(file, content);
    writeFileSync(`${file}.ots`, proof);

    console.log(`\nOpenTimestamps proof submitted and written:\n  ${file}\n  ${file}.ots`);
    console.log('Complete it later with the OpenTimestamps client (after ~a few hours of Bitcoin aggregation):');
    console.log(`  ots upgrade ${file}.ots`);
    console.log(`  ots verify  ${file}.ots`);
  } catch (e) {
    console.log(`\n(OpenTimestamps submission failed: ${e instanceof Error ? e.message : String(e)})`);
    console.log('The receipt above is still valid — submit the head hash manually to OpenTimestamps / a TSA / a public git repo (D2).');
  }
}

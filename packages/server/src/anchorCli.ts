/**
 * `npm run anchor` — append an external-anchor entry for the current ledger head
 * and emit a publishable receipt (spec D2). Run it after a batch of sessions,
 * then publish the printed hash to an independent, immutable place.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LedgerStore } from './ledgerStore.js';
import { anchorHead } from './anchor.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ledgerPath = resolve(repoRoot, process.env.PSYMETER_LEDGER ?? 'ledger/dev.jsonl');
const receiptsPath = resolve(dirname(ledgerPath), 'anchor-receipts.jsonl');

const store = new LedgerStore(ledgerPath);
const r = anchorHead(store, receiptsPath);

// eslint-disable-next-line no-console
console.log(`anchored ledger head:\n  ${r.headHash}\n  at ${r.anchoredAt}`);
console.log(`receipt appended to ${receiptsPath}`);
console.log('\nPublish this hash to an independent, immutable place to freeze the corpus in time (D2):');
console.log('  - commit + push it to a public git repo, and/or');
console.log('  - submit it to OpenTimestamps (https://opentimestamps.org), and/or');
console.log('  - timestamp it with an RFC 3161 TSA.');

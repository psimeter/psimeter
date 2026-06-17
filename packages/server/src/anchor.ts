import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LedgerStore } from './ledgerStore.js';

/**
 * Append an `external.anchor` entry committing to the current ledger head and
 * write a publishable receipt line (spec D2).
 *
 * Actually PUBLISHING the receipt to an independent, immutable place — a public
 * git repo, an RFC 3161 TSA, or OpenTimestamps — is the operational step that
 * freezes the corpus in time and prevents silent retroactive edits. This
 * function produces exactly the artifact to publish.
 */
export function anchorHead(store: LedgerStore, receiptsPath: string): { headHash: string; anchoredAt: string } {
  const head = store.currentHead;
  if (!head) throw new Error('nothing to anchor (empty ledger)');

  const receipt = { headHash: head.entryHash, anchoredAt: new Date().toISOString() };
  store.append('external.anchor', receipt);
  mkdirSync(dirname(receiptsPath), { recursive: true });
  appendFileSync(receiptsPath, JSON.stringify(receipt) + '\n');
  return receipt;
}

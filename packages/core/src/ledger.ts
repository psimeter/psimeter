import { canonicalize } from './canonicalize.js';
import { sha256 } from './hash.js';

export type LedgerEntryType =
  | 'genesis'
  | 'session.open'
  | 'session.seal'
  | 'baseline.seal'
  | 'external.anchor';

/** One immutable, hash-chained ledger entry (spec §8.5). */
export interface LedgerEntry {
  seq: number;
  /** ISO-8601 timestamp; informational only — the beacon is the trusted time. */
  ts: string;
  /** entryHash of the previous entry (GENESIS_PREV for the first entry). */
  prevHash: string;
  type: LedgerEntryType;
  /** Type-specific; MUST contain only canonicalizable values (integers/strings). */
  payload: unknown;
  /** sha256 over the canonical (seq, ts, prevHash, type, payload). */
  entryHash: string;
}

export const GENESIS_PREV = 'sha256:' + '0'.repeat(64);

/** Hash an entry over every field except `entryHash` itself. */
export function hashEntry(e: Omit<LedgerEntry, 'entryHash'>): string {
  return sha256(
    canonicalize({ seq: e.seq, ts: e.ts, prevHash: e.prevHash, type: e.type, payload: e.payload }),
  );
}

/** Append a new entry after `prev` (pass null to create the genesis entry). */
export function appendEntry(
  prev: LedgerEntry | null,
  type: LedgerEntryType,
  payload: unknown,
  ts: string = new Date().toISOString(),
): LedgerEntry {
  const seq = prev ? prev.seq + 1 : 0;
  const prevHash = prev ? prev.entryHash : GENESIS_PREV;
  const base = { seq, ts, prevHash, type, payload };
  return { ...base, entryHash: hashEntry(base) };
}

/**
 * Verify hash-chain integrity. Returns the index of the first bad entry, or -1
 * if the chain is fully intact. Catches reordering, insertion, deletion, and
 * any payload tampering.
 */
export function verifyChain(entries: LedgerEntry[]): number {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const expectedSeq = i === 0 ? 0 : entries[i - 1]!.seq + 1;
    const expectedPrev = i === 0 ? GENESIS_PREV : entries[i - 1]!.entryHash;
    if (e.seq !== expectedSeq) return i;
    if (e.prevHash !== expectedPrev) return i;
    if (hashEntry(e) !== e.entryHash) return i;
  }
  return -1;
}

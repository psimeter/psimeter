import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { appendEntry, type LedgerEntry, type LedgerEntryType } from '@psymeter/core';

/**
 * Minimal append-only, file-backed ledger (spec §8.5).
 *
 * Keeps the current chain head in memory and appends each new entry as one JSON
 * line. On startup it resumes from an existing file so the hash chain is
 * continuous across restarts. (Content-addressed raw-blob storage and external
 * anchoring are the next milestone — see spec D2.)
 */
export class LedgerStore {
  private head: LedgerEntry | null = null;

  constructor(private readonly path: string) {
    if (existsSync(path)) {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.length > 0);
      if (lines.length > 0) this.head = JSON.parse(lines[lines.length - 1]!) as LedgerEntry;
    } else {
      mkdirSync(dirname(path), { recursive: true });
    }
  }

  get currentHead(): LedgerEntry | null {
    return this.head;
  }

  /** Chain a new entry onto the head and persist it. */
  append(type: LedgerEntryType, payload: unknown): LedgerEntry {
    const entry = appendEntry(this.head, type, payload);
    this.head = entry;
    appendFileSync(this.path, JSON.stringify(entry) + '\n');
    return entry;
  }

  /** Write the genesis entry if the ledger is empty. */
  ensureGenesis(): void {
    if (!this.head) this.append('genesis', { note: 'psymeter dev ledger' });
  }
}

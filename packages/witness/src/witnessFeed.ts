import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { appendEntry, type LedgerEntry } from '@psymeter/core';
import { requestTimestamp } from './tsa.js';

/**
 * The witness's OWN append-only, hash-chained feed (spec D16).
 *
 * This is the independent artifact that makes witnessing meaningful: every
 * co-signature is published here, in a sibling ledger verified by the SAME core
 * chaining the main ledger uses, so the experiment server cannot silently drop an
 * inconvenient attestation (the only copy is NOT in the server's ledger). Anyone
 * may mirror `GET /witness/feed` in real time. The head is periodically TSA- and
 * (via the main ledger's witness.anchor + OTS) Bitcoin-anchored.
 */
export interface FeedAppendResult {
  feedSeq: number;
  feedEntryHash: string;
}

export class WitnessFeed {
  private head: LedgerEntry | null = null;
  private readonly tsrDir: string;
  private readonly stampsPath: string;

  constructor(private readonly path: string) {
    if (existsSync(path)) {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.length > 0);
      if (lines.length > 0) this.head = JSON.parse(lines[lines.length - 1]!) as LedgerEntry;
    } else {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.tsrDir = resolve(dirname(path), 'witness-tsr');
    this.stampsPath = resolve(dirname(path), 'witness-feed.stamps.jsonl');
    if (!this.head) this.appendEntry('genesis', { note: 'psymeter witness feed' });
  }

  get currentHead(): LedgerEntry | null {
    return this.head;
  }

  get feedPath(): string {
    return this.path;
  }

  /** Append a co-signature; returns its feed coordinates for the inline cross-ref. */
  attest(payload: Record<string, unknown>): FeedAppendResult {
    const entry = this.appendEntry('witness.attest', payload);
    return { feedSeq: entry.seq, feedEntryHash: entry.entryHash };
  }

  private appendEntry(type: 'genesis' | 'witness.attest', payload: unknown): LedgerEntry {
    const entry = appendEntry(this.head, type, payload);
    this.head = entry;
    appendFileSync(this.path, JSON.stringify(entry) + '\n');
    return entry;
  }

  /**
   * Best-effort: stamp the current head with the RFC 3161 TSA. Failures (offline,
   * TSA down) are logged and swallowed — the in-code anchors (witness Ed25519 +
   * self-verified drand round) still hold; the TSA is the fine-grained independent
   * upgrade. Records {feedSeq, headHash, tsr} so a verifier can bind a token to a
   * feed prefix.
   */
  async stampHead(tsaUrl: string): Promise<void> {
    const head = this.head;
    if (!head || head.seq === 0) return;
    try {
      const digest = new Uint8Array(createHash('sha256').update(head.entryHash).digest());
      const tsr = await requestTimestamp(tsaUrl, digest);
      mkdirSync(this.tsrDir, { recursive: true });
      const tsrName = `${head.seq}-${head.entryHash.slice(7, 19)}.tsr`;
      writeFileSync(resolve(this.tsrDir, tsrName), tsr);
      appendFileSync(
        this.stampsPath,
        JSON.stringify({ feedSeq: head.seq, headHash: head.entryHash, tsr: `witness-tsr/${tsrName}`, requestedAt: new Date().toISOString() }) + '\n',
      );
      // eslint-disable-next-line no-console
      console.log(`[witness] TSA-stamped feed head seq=${head.seq} (${tsr.length} bytes)`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`[witness] TSA stamp skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

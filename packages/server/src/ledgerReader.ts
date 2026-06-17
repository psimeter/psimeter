import { existsSync, readFileSync, statSync } from 'node:fs';
import { sessionZ, type Intention, type LedgerEntry } from '@psymeter/core';

/**
 * Read-only view over the append-only ledger (spec §8.5) for the public site's
 * browse / stats / history endpoints.
 *
 * Everything here is DISPLAY ONLY and non-authoritative (D4): the confirmatory
 * numbers are produced by analysis/analyze.py over the published raw data, never
 * by this server. Parsed entries are cached and invalidated by the file's
 * size+mtime, so a freshly sealed session shows up without a restart.
 */

/** `session.open` payload as committed in session.ts/commitOpen. */
export interface OpenPayload {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  intention: Intention;
  operatorPubKey: string;
  operatorSig: string;
  beacon: { source: string; round: number; value: string; chainHash?: string; signature?: string };
  entropySource: { id: string; kind: string; confirmatory: boolean; metadata: unknown };
  serverNonce: string;
  precommit: string;
  anchor: string;
}

/** `session.seal` payload as committed in session.ts/generateAndSeal. */
export interface SealPayload {
  sessionId: string;
  openEntryHash: string;
  outputCommitment: string;
  rawSha256: string;
  rawBlobRef: string;
  leafBytes: number;
  nSamples: number;
  ones: number;
}

/** Flattened, display-only summary of one session (open joined with its seal). */
export interface SessionSummary {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  intention: Intention;
  operatorPubKey: string;
  anchor: string;
  beaconRound: number;
  entropy: { id: string; confirmatory: boolean };
  ts: string;
  sealed: boolean;
  ones: number | null;
  nSamples: number | null;
  zDisplay: number | null;
}

interface Joined {
  open: LedgerEntry;
  seal: LedgerEntry | null;
}

export class LedgerReader {
  private cacheKey = '';
  private cached: LedgerEntry[] = [];

  constructor(private readonly path: string) {}

  /** Parse all entries, re-reading only when the file changes. */
  entries(): LedgerEntry[] {
    if (!existsSync(this.path)) return [];
    const st = statSync(this.path);
    const key = `${st.size}:${st.mtimeMs}`;
    if (key !== this.cacheKey) {
      const lines = readFileSync(this.path, 'utf8').split(/\r?\n/).filter((l) => l.length > 0);
      this.cached = lines.map((l) => JSON.parse(l) as LedgerEntry);
      this.cacheKey = key;
    }
    return this.cached;
  }

  /** Sessions in commit order, each joined with its seal (null if still open). */
  private joined(): Joined[] {
    const bySession = new Map<string, Joined>();
    const order: string[] = [];
    for (const e of this.entries()) {
      if (e.type === 'session.open') {
        const p = e.payload as OpenPayload;
        bySession.set(p.sessionId, { open: e, seal: null });
        order.push(p.sessionId);
      } else if (e.type === 'session.seal') {
        const p = e.payload as SealPayload;
        const j = bySession.get(p.sessionId);
        if (j) j.seal = e;
      }
    }
    return order.map((id) => bySession.get(id)!);
  }

  summaries(): SessionSummary[] {
    return this.joined().map(toSummary);
  }

  /** Full open + seal entries for one session (for in-browser verification). */
  detail(sessionId: string): Joined | null {
    return this.joined().find((j) => (j.open.payload as OpenPayload).sessionId === sessionId) ?? null;
  }
}

function toSummary(j: Joined): SessionSummary {
  const o = j.open.payload as OpenPayload;
  const s = j.seal ? (j.seal.payload as SealPayload) : null;
  return {
    sessionId: o.sessionId,
    experimentId: o.experimentId,
    experimentVersion: o.experimentVersion,
    intention: o.intention,
    operatorPubKey: o.operatorPubKey,
    anchor: o.anchor,
    beaconRound: o.beacon.round,
    entropy: { id: o.entropySource.id, confirmatory: o.entropySource.confirmatory },
    ts: j.seal ? j.seal.ts : j.open.ts,
    sealed: s !== null,
    ones: s ? s.ones : null,
    nSamples: s ? s.nSamples : null,
    zDisplay: s ? sessionZ(s.ones, s.nSamples) : null,
  };
}

export interface IntentionStat { n: number; meanZ: number | null; }

/** Honest global aggregate: per-intention means, anomaly counts vs the counts
 * chance alone predicts, and the HIGH−LOW contrast (cancels static bias). */
export function globalStats(rows: SessionSummary[]) {
  const sealed = rows.filter((r): r is SessionSummary & { zDisplay: number; nSamples: number } => r.sealed);
  const totalBits = sealed.reduce((n, r) => n + r.nSamples, 0);

  const acc: Record<Intention, { n: number; sum: number }> = {
    HIGH: { n: 0, sum: 0 },
    LOW: { n: 0, sum: 0 },
    BASELINE: { n: 0, sum: 0 },
  };
  let z2 = 0;
  let z3 = 0;
  for (const r of sealed) {
    acc[r.intention].n += 1;
    acc[r.intention].sum += r.zDisplay;
    if (Math.abs(r.zDisplay) > 2) z2 += 1;
    if (Math.abs(r.zDisplay) > 3) z3 += 1;
  }
  const meanOf = (k: Intention): number | null => (acc[k].n ? acc[k].sum / acc[k].n : null);
  const hi = meanOf('HIGH');
  const lo = meanOf('LOW');

  const extremes = sealed
    .slice()
    .sort((a, b) => Math.abs(b.zDisplay) - Math.abs(a.zDisplay))
    .slice(0, 10);

  return {
    sessions: rows.length,
    sealed: sealed.length,
    totalBits,
    byIntention: {
      HIGH: { n: acc.HIGH.n, meanZ: meanOf('HIGH') },
      LOW: { n: acc.LOW.n, meanZ: meanOf('LOW') },
      BASELINE: { n: acc.BASELINE.n, meanZ: meanOf('BASELINE') },
    } satisfies Record<Intention, IntentionStat>,
    // Under the null, P(|z|>2)≈0.0455 and P(|z|>3)≈0.0027 per session.
    anomalies: {
      z2,
      z3,
      expectedZ2: sealed.length * 0.0455,
      expectedZ3: sealed.length * 0.0027,
    },
    highMinusLow: hi !== null && lo !== null ? hi - lo : null,
    extremes,
  };
}

/** Per-experiment counts for the experiments browser. */
export function experimentStat(rows: SessionSummary[], experimentId: string) {
  const mine = rows.filter((r) => r.experimentId === experimentId);
  const sealed = mine.filter((r) => r.sealed);
  const byIntention: Record<Intention, number> = { HIGH: 0, LOW: 0, BASELINE: 0 };
  for (const r of sealed) byIntention[r.intention] += 1;
  return { sessions: mine.length, sealed: sealed.length, byIntention };
}

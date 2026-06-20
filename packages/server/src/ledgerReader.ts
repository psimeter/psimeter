import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  displayZFromSeal,
  psiScoreFromSessions,
  PSI_CANDIDATE_WEALTH,
  PSI_CANDIDATE_MIN_SESSIONS,
  type PsiScore,
  type Choice,
  type LedgerEntry,
} from '@psymeter/core';

/**
 * Read-only view over the append-only ledger (spec §8.5) for the public site's
 * browse / stats / history endpoints.
 *
 * Everything here is DISPLAY ONLY and non-authoritative (D4): the confirmatory
 * numbers are produced by analysis/analyze.py over the published raw data, never
 * by this server. Parsed entries are cached and invalidated by the file's
 * size+mtime, so a freshly sealed session shows up without a restart.
 *
 * Kind-agnostic: the per-session display z is derived from the seal payload's
 * own shape via `displayZFromSeal` (micro-PK bits, precognition hit-rate, …), so
 * nothing here branches on experiment kind.
 */

/** `session.open` payload as committed in session.ts/commitOpen. */
export interface OpenPayload {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  /** The committed choice (micro-PK intention; '' when per-trial, e.g. precog). */
  intention: Choice;
  operatorPubKey: string;
  operatorSig: string;
  beacon: { source: string; round: number; value: string; chainHash?: string; signature?: string };
  entropySource: { id: string; kind: string; confirmatory: boolean; metadata: unknown };
  serverNonce: string;
  precommit: string;
  anchor: string;
}

/** A sealed payload, read generically — micro-PK commits ones/nSamples,
 * precognition commits hits/trials/optionsPerTrial; both carry the commitments. */
type SealPayload = Record<string, unknown> & {
  sessionId: string;
  openEntryHash: string;
  outputCommitment: string;
  rawBlobRef: string;
};

/** Flattened, display-only summary of one session (open joined with its seal). */
export interface SessionSummary {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  /** The committed choice for display/grouping (was `intention`). */
  choice: Choice;
  operatorPubKey: string;
  anchor: string;
  beaconRound: number;
  entropy: { id: string; confirmatory: boolean };
  ts: string;
  sealed: boolean;
  /** Micro-PK volume (bits); null for kinds that don't produce a bit stream. */
  nSamples: number | null;
  /** Precognition volume; null for kinds without forced-choice trials. */
  trials: number | null;
  hits: number | null;
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

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function toSummary(j: Joined): SessionSummary {
  const o = j.open.payload as OpenPayload;
  const s = j.seal ? (j.seal.payload as SealPayload) : null;
  return {
    sessionId: o.sessionId,
    experimentId: o.experimentId,
    experimentVersion: o.experimentVersion,
    choice: o.intention,
    operatorPubKey: o.operatorPubKey,
    anchor: o.anchor,
    beaconRound: o.beacon.round,
    entropy: { id: o.entropySource.id, confirmatory: o.entropySource.confirmatory },
    ts: j.seal ? j.seal.ts : j.open.ts,
    sealed: s !== null,
    nSamples: s ? num(s.nSamples) : null,
    trials: s ? num(s.trials) : null,
    hits: s ? num(s.hits) : null,
    zDisplay: displayZFromSeal(s),
  };
}

export interface ChoiceStat { n: number; meanZ: number | null; }

/** Honest global aggregate: per-choice means, anomaly counts vs the counts
 * chance alone predicts, and (for micro-PK) the HIGH−LOW contrast. Grouping is
 * by the committed choice, so it adapts to whatever vocabulary the corpus holds. */
export function globalStats(rows: SessionSummary[]) {
  const sealed = rows.filter((r): r is SessionSummary & { zDisplay: number } => r.sealed && r.zDisplay !== null);
  const totalBits = sealed.reduce((n, r) => n + (r.nSamples ?? 0), 0);

  const acc = new Map<string, { n: number; sum: number }>();
  let z2 = 0;
  let z3 = 0;
  for (const r of sealed) {
    const a = acc.get(r.choice) ?? { n: 0, sum: 0 };
    a.n += 1;
    a.sum += r.zDisplay;
    acc.set(r.choice, a);
    if (Math.abs(r.zDisplay) > 2) z2 += 1;
    if (Math.abs(r.zDisplay) > 3) z3 += 1;
  }
  const byChoice: Record<string, ChoiceStat> = {};
  for (const [k, a] of acc) byChoice[k] = { n: a.n, meanZ: a.n ? a.sum / a.n : null };

  const hi = byChoice.HIGH?.meanZ ?? null;
  const lo = byChoice.LOW?.meanZ ?? null;

  const extremes = sealed
    .slice()
    .sort((a, b) => Math.abs(b.zDisplay) - Math.abs(a.zDisplay))
    .slice(0, 10);

  return {
    sessions: rows.length,
    sealed: sealed.length,
    totalBits,
    byChoice,
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

/** One ranked operator on the psi leaderboard (spec D15). */
export interface OperatorRanking {
  operatorPubKey: string;
  totalSessions: number;
  lastTs: string;
  psi: PsiScore;
}

/** All of an operator's sealed sessions as (choice, z) pairs for the psi score.
 *  Unsealed rows carry z = null and are dropped by psiScoreFromSessions. */
function operatorPairs(rows: SessionSummary[]): { choice: Choice; z: number | null }[] {
  return rows.map((r) => ({ choice: r.choice, z: r.zDisplay }));
}

/** The psi score for one operator, recomputed from the ledger (display-only, §8.1). */
export function psiForOperator(rows: SessionSummary[], operatorPubKey: string): PsiScore {
  return psiScoreFromSessions(operatorPairs(rows.filter((r) => r.operatorPubKey === operatorPubKey)));
}

/**
 * The psi leaderboard (spec D15 / H1): operators ranked by their anytime-valid
 * test-martingale wealth. This replaces the old "most extreme sessions" list —
 * anomalous single sessions are expected by chance (D4); sustained per-operator
 * deviation in the declared direction is the thing worth surfacing. Still DISPLAY
 * ONLY: analysis/analyze.py recomputes every score from the published ledger.
 */
export function leaderboard(rows: SessionSummary[]) {
  const byOp = new Map<string, SessionSummary[]>();
  for (const r of rows) {
    const list = byOp.get(r.operatorPubKey) ?? [];
    list.push(r);
    byOp.set(r.operatorPubKey, list);
  }
  const operators: OperatorRanking[] = [];
  for (const [operatorPubKey, sessions] of byOp) {
    operators.push({
      operatorPubKey,
      totalSessions: sessions.length,
      lastTs: sessions.reduce((m, s) => (s.ts > m ? s.ts : m), ''),
      psi: psiScoreFromSessions(operatorPairs(sessions)),
    });
  }
  // Rank by wealth (the e-value); break ties by who has scored more sessions.
  operators.sort((a, b) => b.psi.wealth - a.psi.wealth || b.psi.scoredSessions - a.psi.scoredSessions);

  const eligibleOperators = operators.filter((o) => o.psi.scoredSessions >= PSI_CANDIDATE_MIN_SESSIONS).length;
  return {
    operators,
    meta: {
      totalOperators: operators.length,
      eligibleOperators,
      candidates: operators.filter((o) => o.psi.isCandidate).length,
      candidateWealth: PSI_CANDIDATE_WEALTH,
      candidateMinSessions: PSI_CANDIDATE_MIN_SESSIONS,
      // Honest look-elsewhere accounting (D4/D15): with many operators, candidates
      // are expected by chance — which is why a candidate must REPLICATE.
      expectedFalseCandidates: eligibleOperators / PSI_CANDIDATE_WEALTH,
    },
  };
}

/** Per-experiment counts for the experiments browser, grouped by committed choice. */
export function experimentStat(rows: SessionSummary[], experimentId: string) {
  const mine = rows.filter((r) => r.experimentId === experimentId);
  const sealed = mine.filter((r) => r.sealed);
  const byChoice: Record<string, number> = {};
  for (const r of sealed) byChoice[r.choice] = (byChoice[r.choice] ?? 0) + 1;
  return { sessions: mine.length, sealed: sealed.length, byChoice };
}

import {
  directionalZ,
  psiScoreFromStats,
  PSI_CANDIDATE_WEALTH,
  PSI_CANDIDATE_MIN_SESSIONS,
  type LedgerEntry,
} from '@psimeter/core';
import { toSummary, type SessionSummary, type ChoiceStat, type OperatorRanking, type OpenPayload } from './ledgerReader.js';

/**
 * In-memory MATERIALIZED VIEW over the append-only ledger (spec D18).
 *
 * The browse-facing endpoints (/api/stats, /api/psi, /api/leaderboard) must NOT
 * recompute over the whole ledger per request — that is O(N) in sessions and
 * re-parses the file on every seal, which does not scale. Instead this view folds
 * each entry exactly once (incrementally as it is appended, and once over the
 * existing ledger at boot) into small running aggregates:
 *
 *   • global accumulators (counts, totalBits, per-choice mean z, anomaly counts);
 *   • per-OPERATOR state — only the psi score's two SUFFICIENT STATISTICS
 *     (`scoredN`, `sumZ`); the wealth is a pure function of those (psiScoreFromStats),
 *     so we never store anyone's session history. Memory is O(operators), not
 *     O(sessions).
 *
 * It is DISPLAY-ONLY and fully rebuildable from the ledger (the authority remains
 * analysis/analyze.py, D4) — so it can be thrown away and re-folded at any time.
 * The leaderboard is a fixed top-N of ELIGIBLE operators (≥ PSI_CANDIDATE_MIN_SESSIONS,
 * so a single lucky session can never top it — D13/D15); there is no pagination.
 */

const LEADERBOARD_SIZE = 25;
const EXTREMES_SIZE = 10;
const LEADERBOARD_CACHE_MS = 2000;

/** Per-operator running state — just the psi sufficient stats plus display meta. */
interface OpState {
  scoredN: number; // sessions scoring toward H1 (the martingale's n)
  sumZ: number; //   Σ directional z (the martingale's sufficient statistic)
  totalSessions: number; // all of this operator's sessions (incl. unsealed/BASELINE)
  lastTs: string;
}

interface LeaderboardSnapshot {
  ts: number;
  operators: OperatorRanking[];
  meta: LeaderboardMeta;
  /** Descending logWealth of every eligible operator, for O(log n) self-rank. */
  eligibleLogW: number[];
}

interface LeaderboardMeta {
  totalOperators: number;
  eligibleOperators: number;
  candidates: number;
  candidateWealth: number;
  candidateMinSessions: number;
  expectedFalseCandidates: number;
}

export interface SelfRanking {
  ranking: OperatorRanking;
  /** 1-based rank among eligible operators, or null when not yet eligible. */
  rank: number | null;
}

export class ReadModel {
  private ops = new Map<string, OpState>();
  /** Open entries awaiting their seal, so a seal can be joined to its operator/choice. */
  private pending = new Map<string, LedgerEntry>();

  // --- global accumulators (mirror ledgerReader.globalStats exactly) ---
  private sessions = 0; // total opens
  private sealed = 0; //   sealed sessions with a non-null display z
  private totalBits = 0;
  private byChoice = new Map<string, { n: number; sum: number }>(); // sum of display z
  private z2 = 0;
  private z3 = 0;
  private extremes: SessionSummary[] = []; // top-10 by |z|, descending

  private lbCache: LeaderboardSnapshot | null = null;

  /** Fold one ledger entry into the view. Idempotent per entry (call once each). */
  ingest(e: LedgerEntry): void {
    if (e.type === 'session.open') {
      const p = e.payload as OpenPayload;
      this.pending.set(p.sessionId, e);
      this.sessions += 1;
      const op = this.ops.get(p.operatorPubKey) ?? { scoredN: 0, sumZ: 0, totalSessions: 0, lastTs: '' };
      op.totalSessions += 1;
      if (e.ts > op.lastTs) op.lastTs = e.ts;
      this.ops.set(p.operatorPubKey, op);
    } else if (e.type === 'session.seal') {
      const sp = e.payload as { sessionId: string };
      const open = this.pending.get(sp.sessionId);
      if (!open) return; // a seal with no known open — skip rather than guess
      this.pending.delete(sp.sessionId);
      this.applySeal(toSummary({ open, seal: e }));
      this.lbCache = null; // operator wealth changed; invalidate the throttled snapshot
    }
    // genesis / external.anchor / witness.* carry no display stats — ignored.
  }

  private applySeal(s: SessionSummary): void {
    const op = this.ops.get(s.operatorPubKey);
    if (op && s.ts > op.lastTs) op.lastTs = s.ts;

    // Directional contribution to the operator's psi score (BASELINE / unknown
    // vocab / unsealed → null and excluded, matching psiScoreFromSessions).
    const d = directionalZ(s.choice, s.zDisplay);
    if (op && d !== null) {
      op.scoredN += 1;
      op.sumZ += d;
    }

    // Global stats count only sealed sessions with a usable display z (as globalStats does).
    if (s.zDisplay === null) return;
    this.sealed += 1;
    this.totalBits += s.nSamples ?? 0;
    const c = this.byChoice.get(s.choice) ?? { n: 0, sum: 0 };
    c.n += 1;
    c.sum += s.zDisplay;
    this.byChoice.set(s.choice, c);
    if (Math.abs(s.zDisplay) > 2) this.z2 += 1;
    if (Math.abs(s.zDisplay) > 3) this.z3 += 1;
    this.insertExtreme(s);
  }

  private insertExtreme(s: SessionSummary): void {
    const az = Math.abs(s.zDisplay ?? 0);
    if (this.extremes.length >= EXTREMES_SIZE && az <= Math.abs(this.extremes[this.extremes.length - 1]!.zDisplay ?? 0)) return;
    this.extremes.push(s);
    this.extremes.sort((a, b) => Math.abs(b.zDisplay ?? 0) - Math.abs(a.zDisplay ?? 0));
    if (this.extremes.length > EXTREMES_SIZE) this.extremes.length = EXTREMES_SIZE;
  }

  /** Honest global aggregate — same shape as ledgerReader.globalStats, O(1). */
  stats() {
    const byChoice: Record<string, ChoiceStat> = {};
    for (const [k, a] of this.byChoice) byChoice[k] = { n: a.n, meanZ: a.n ? a.sum / a.n : null };
    const hi = byChoice.HIGH?.meanZ ?? null;
    const lo = byChoice.LOW?.meanZ ?? null;
    return {
      sessions: this.sessions,
      sealed: this.sealed,
      totalBits: this.totalBits,
      byChoice,
      anomalies: { z2: this.z2, z3: this.z3, expectedZ2: this.sealed * 0.0455, expectedZ3: this.sealed * 0.0027 },
      highMinusLow: hi !== null && lo !== null ? hi - lo : null,
      extremes: this.extremes.slice(),
    };
  }

  /** This operator's psi score, recomputed from its two stats — O(1). */
  psiFor(operatorPubKey: string) {
    const op = this.ops.get(operatorPubKey);
    return psiScoreFromStats(op?.scoredN ?? 0, op?.sumZ ?? 0);
  }

  /**
   * Top-N eligible operators (no pagination), plus aggregate meta, plus — when an
   * operator key is supplied — that operator's own ranking pinned with its rank,
   * so a player always sees where they stand without paging the whole board.
   */
  leaderboard(self?: string): { operators: OperatorRanking[]; meta: LeaderboardMeta; self: SelfRanking | null } {
    const snap = this.snapshot();
    let selfOut: SelfRanking | null = null;
    if (self) {
      const op = this.ops.get(self);
      if (op) {
        const psi = psiScoreFromStats(op.scoredN, op.sumZ);
        let rank: number | null = null;
        if (op.scoredN >= PSI_CANDIDATE_MIN_SESSIONS) rank = aboveCount(snap.eligibleLogW, psi.logWealth) + 1;
        selfOut = { ranking: { operatorPubKey: self, totalSessions: op.totalSessions, lastTs: op.lastTs, psi }, rank };
      }
    }
    return { operators: snap.operators, meta: snap.meta, self: selfOut };
  }

  /** Throttled recompute of the ranked board (display-only, ≤ once per 2s). */
  private snapshot(): LeaderboardSnapshot {
    const now = Date.now();
    if (this.lbCache && now - this.lbCache.ts <= LEADERBOARD_CACHE_MS) return this.lbCache;

    const eligibleLogW: number[] = [];
    let candidates = 0;
    const ranked: { r: OperatorRanking; logW: number }[] = [];
    for (const [key, op] of this.ops) {
      const psi = psiScoreFromStats(op.scoredN, op.sumZ);
      if (op.scoredN >= PSI_CANDIDATE_MIN_SESSIONS) {
        eligibleLogW.push(psi.logWealth);
        if (psi.isCandidate) candidates += 1;
        ranked.push({ r: { operatorPubKey: key, totalSessions: op.totalSessions, lastTs: op.lastTs, psi }, logW: psi.logWealth });
      }
    }
    eligibleLogW.sort((a, b) => b - a);
    ranked.sort((a, b) => b.logW - a.logW || b.r.psi.scoredSessions - a.r.psi.scoredSessions);
    const operators = ranked.slice(0, LEADERBOARD_SIZE).map((x) => x.r);

    const eligibleOperators = eligibleLogW.length;
    this.lbCache = {
      ts: now,
      operators,
      eligibleLogW,
      meta: {
        totalOperators: this.ops.size,
        eligibleOperators,
        candidates,
        candidateWealth: PSI_CANDIDATE_WEALTH,
        candidateMinSessions: PSI_CANDIDATE_MIN_SESSIONS,
        expectedFalseCandidates: eligibleOperators / PSI_CANDIDATE_WEALTH,
      },
    };
    return this.lbCache;
  }
}

/** Count of values strictly greater than `x` in a descending-sorted array (binary search). */
function aboveCount(descending: number[], x: number): number {
  let lo = 0;
  let hi = descending.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (descending[mid]! > x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

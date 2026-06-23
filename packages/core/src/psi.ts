/**
 * psi.ts — the per-operator "psi score": an ANYTIME-VALID test martingale
 * (e-value) measuring whether an operator beats chance *consistently across their
 * own sessions*, in their pre-declared direction. This is the public, gamified
 * face of hypothesis **H1** (spec §5) and decision **D15**.
 *
 * Why a test martingale and not a fixed-N z-test. The public score updates live
 * after every session, and players will naturally keep going while it looks good
 * and stop when it peaks. A fixed-N statistic (e.g. a Stouffer z) is invalidated
 * by that operator-level optional stopping — the exact failure mode this project
 * pre-empts everywhere else (D3, and the Bösch 2006 critique). A test martingale
 * is *anytime-valid*: under the null its "wealth" W is a non-negative martingale
 * with E[W]=1, so by Ville's inequality P( sup_t W_t ≥ 1/α ) ≤ α. You may watch
 * it live, stop whenever, and even rank a leaderboard by peak wealth — and the
 * false-positive guarantee still holds.
 *
 * Construction (kind-agnostic, built on the per-session DIRECTIONAL z):
 *   • Each scored session contributes a directional z `d_i`: success in the
 *     operator's declared direction is positive. Micro-PK HIGH→+z, LOW→−z;
 *     BASELINE calibrates and is excluded (D5). Precognition has no session-level
 *     choice and its hit-rate z is already oriented (more hits ⇒ +z). Under H0,
 *     d_i ~ N(0,1) (an excellent approximation at the fixed session sizes).
 *   • We bet against H0 with a one-sided MIXTURE over a fixed grid of alternative
 *     per-session effects δ_j>0. Each component exp(δ_j·S − n·δ_j²/2) is itself a
 *     martingale (E[exp(δZ − δ²/2)] = 1 for Z~N(0,1)), so any fixed convex
 *     mixture of them is too. The grid is one-sided (all δ_j > 0), so only
 *     declared-direction effect builds wealth; going the wrong way shrinks it.
 *     ANY fixed grid is valid (Ville) — the grid affects power, never validity.
 *
 * Static-bias caveat (micro-PK only). The directional z is taken against the
 * fair-coin 0.5. A genuinely physical source can have a tiny static bias (D10);
 * an operator who only ever declares HIGH would then accumulate wealth from
 * source bias, not psi. This is why the clean unit is the within-operator
 * HIGH−LOW contrast (§5) and why HIGH/LOW should be balanced. For the *screening*
 * score this is documented and acceptable; the *confirmatory* replication centers
 * on the empirically calibrated baseline (D5). Precognition is unaffected — its
 * chance rate is an exact beacon-derived fair coin (D14).
 *
 * DISPLAY ONLY, like every on-screen statistic (spec §8.1): the authoritative
 * score is recomputed from the published ledger by analysis/analyze.py, where the
 * grid and thresholds below are mirrored exactly. The score is a SCREENING
 * statistic (§5, two-phase): crossing the candidate threshold flags an operator
 * for a frozen, pre-registered confirmatory replication — it is never, by itself,
 * proof of psi (D4 / D15).
 */

/**
 * Pre-registered one-sided alternative grid, in per-session directional-z units,
 * mixed with equal weights. Spans micro-PK's tiny per-session effect (δ≈0.1, the
 * canonical ~1–2×10⁻⁴/bit over 180k bits, spec D13) up to a strong precognition
 * effect (δ≈0.8). Frozen: changing it is a deliberate, versioned methodology
 * change (mirror it in analysis/analyze.py).
 */
export const PSI_ALT_GRID: readonly number[] = [0.1, 0.2, 0.4, 0.8];

/** Wealth (e-value) at the candidate threshold: anytime-valid one-tailed p ≤ 1/1000. */
export const PSI_CANDIDATE_WEALTH = 1000;

/** Minimum scored sessions before "candidate" can be claimed — H1 is about
 *  consistency, not one lucky run (spec D13). */
export const PSI_CANDIDATE_MIN_SESSIONS = 5;

/** The ladder (gamification). Each tier is the wealth at which it is reached. */
export const PSI_TIERS: readonly { readonly min: number; readonly name: string }[] = [
  { min: 0, name: 'Baseline' },
  { min: 3, name: 'Flicker' },
  { min: 10, name: 'Signal' },
  { min: 100, name: 'Strong signal' },
  { min: PSI_CANDIDATE_WEALTH, name: 'Candidate' },
];

export interface PsiScore {
  /** Sessions that scored toward H1 (BASELINE / unsealed excluded). */
  scoredSessions: number;
  /** Sum of directional z over scored sessions (the martingale's sufficient stat). */
  sumZ: number;
  /** Test-martingale wealth W (the e-value). Starts at 1; under H0, E[W]=1 ∀ n. */
  wealth: number;
  /** ln(W), accumulated in log-space for numerical safety. */
  logWealth: number;
  /** Gamified score in DECIBANS of evidence (I.J. Good): 10·log10(W), floored at
   *  0 so "below chance" reads as 0 points. ~+10 points per 10× of evidence. */
  points: number;
  /** Anytime-valid one-tailed p-value (Ville): min(1, 1/W). */
  anytimeP: number;
  /** One-tailed z with the same tail probability — a familiar "sigma" readout. */
  sigma: number;
  /** Ladder index and label (gamification). */
  tier: number;
  tierName: string;
  /** Crossed the candidate threshold. SCREENING only — not proof (D15). */
  isCandidate: boolean;
  /** Wealth still needed to reach the next tier, or null at the top. */
  toNextTier: { name: string; wealth: number } | null;
}

/**
 * A scored session's directional z, or null when it does not score toward H1.
 * HIGH→+z, LOW→−z (micro-PK); BASELINE calibrates and never scores (D5);
 * per-trial kinds (precognition) carry no session-level choice and their z is
 * already oriented. An unknown non-empty vocabulary returns null rather than
 * guess a direction.
 */
export function directionalZ(choice: string, z: number | null): number | null {
  if (z === null) return null;
  switch (choice) {
    case 'HIGH': return z;
    case 'LOW': return -z;
    case 'BASELINE': return null;
    case '': return z;
    default: return null;
  }
}

/** The test-martingale psi score over an operator's directional per-session z's. */
export function psiScore(dirzs: number[]): PsiScore {
  return psiScoreFromStats(dirzs.length, dirzs.reduce((a, b) => a + b, 0));
}

/**
 * The psi score from its two SUFFICIENT STATISTICS — the scored-session count `n`
 * and `sumZ = Σ d_i` — without needing the per-session list. The wealth depends on
 * nothing else (see the construction above), so an incremental materialized view
 * can keep just these two running numbers per operator and call this (spec D18).
 * Identical output to `psiScore` for the same (n, sumZ).
 */
export function psiScoreFromStats(scoredSessions: number, sumZ: number): PsiScore {
  const n = scoredSessions;

  // W = Σ_j (1/J) · exp(δ_j·S − n·δ_j²/2), via log-sum-exp so a strong, real
  // operator's astronomically large wealth never overflows.
  let logWealth = 0; // n === 0 ⇒ empty product per component ⇒ W = Σ w_j = 1
  if (n > 0) {
    const logWeight = -Math.log(PSI_ALT_GRID.length);
    const logs = PSI_ALT_GRID.map((d) => logWeight + d * sumZ - (n * d * d) / 2);
    const max = Math.max(...logs);
    logWealth = max + Math.log(logs.reduce((a, l) => a + Math.exp(l - max), 0));
  }
  const wealth = Math.exp(logWealth);

  const points = Math.max(0, Math.round((10 * logWealth) / Math.LN10));
  const anytimeP = Math.min(1, Math.exp(-logWealth));
  const sigma = anytimeP >= 1 ? 0 : Math.max(0, invNormalCdf(1 - anytimeP));

  let tier = 0;
  for (let i = 0; i < PSI_TIERS.length; i++) if (wealth >= PSI_TIERS[i]!.min) tier = i;
  const reachedCandidateWealth = wealth >= PSI_CANDIDATE_WEALTH;
  const isCandidate = reachedCandidateWealth && n >= PSI_CANDIDATE_MIN_SESSIONS;
  // Hold the badge one rung below "Candidate" until the session floor is met, so
  // it can never be claimed on too few runs.
  if (reachedCandidateWealth && !isCandidate) tier = PSI_TIERS.length - 2;

  const next = PSI_TIERS[tier + 1];
  return {
    scoredSessions: n,
    sumZ,
    wealth,
    logWealth,
    points,
    anytimeP,
    sigma,
    tier,
    tierName: PSI_TIERS[tier]!.name,
    isCandidate,
    toNextTier: next ? { name: next.name, wealth: next.min } : null,
  };
}

/** Convenience: score from raw (choice, display-z) pairs, e.g. ledger summaries.
 *  Unsealed (z=null), BASELINE, and unknown-vocabulary sessions are dropped. */
export function psiScoreFromSessions(sessions: { choice: string; z: number | null }[]): PsiScore {
  const dirzs: number[] = [];
  for (const s of sessions) {
    const d = directionalZ(s.choice, s.z);
    if (d !== null) dirzs.push(d);
  }
  return psiScore(dirzs);
}

/**
 * Inverse standard-normal CDF — Acklam's rational approximation (|abs err| <
 * 1.2e-9 over the open interval). Used only to render the display "sigma" of the
 * anytime-valid p-value; nothing authoritative depends on it (analyze.py uses
 * Python's statistics.NormalDist.inv_cdf instead).
 */
export function invNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
}

/**
 * Scoring helpers for binary micro-PK.
 *
 * IMPORTANT: in the confirmatory pipeline these numbers are recomputed in Python
 * over the published raw data (spec §8.1). The TypeScript versions exist for the
 * live operator display and for unit-testing the maths — they are NEVER the
 * authoritative scientific result.
 */

/** Standard-normal z for `ones` successes out of `n` fair bits (p = 0.5). */
export function sessionZ(ones: number, n: number): number {
  if (n <= 0) throw new Error('n must be positive');
  const mean = n * 0.5;
  const sd = Math.sqrt(n * 0.25);
  return (ones - mean) / sd;
}

/** Stouffer's combined z across independent sessions (equal weights). */
export function stoufferZ(zs: number[]): number {
  if (zs.length === 0) throw new Error('no z-scores to combine');
  const sum = zs.reduce((a, b) => a + b, 0);
  return sum / Math.sqrt(zs.length);
}

/** Two-sided p-value for a z-score. */
export function twoSidedP(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

/** Abramowitz & Stegun 7.1.26 approximation of erfc (|error| < 1.5e-7). */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = y * Math.exp(-x * x);
  return x >= 0 ? r : 2 - r;
}

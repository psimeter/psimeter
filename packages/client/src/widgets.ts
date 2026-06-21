// Small shared UI bits for the data pages.

import { el } from './ui';
import type { PsiScore } from './api';

export function loading(label = 'Loading…'): HTMLElement {
  return el('div', { class: 'loading' }, [el('span', { class: 'spinner' }), label]);
}

export function errorBox(err: unknown): HTMLElement {
  const message = err instanceof Error ? err.message : String(err);
  return el('div', { class: 'callout warn' }, `Couldn’t load: ${message}`);
}

export function stat(value: string, label: string): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'num tnum' }, value),
    el('div', { class: 'lbl' }, label),
  ]);
}

/** Signed, fixed z for display; em-dash for missing values. */
export function fmtZ(z: number | null): string {
  if (z === null) return '—';
  return (z >= 0 ? '+' : '') + z.toFixed(3);
}

export function shortKey(pubKey: string): string {
  return pubKey.replace(/^ed25519:/, '').slice(0, 10);
}

/** "independently witnessed" chip (spec §7.4 / D16). Inline-styled, self-contained. */
export function witnessBadge(label = '✓ independently witnessed'): HTMLElement {
  return el(
    'span',
    {
      class: 'witness-pill',
      title: 'Co-signed live by an independent witness, binding a fresh public-beacon round + RFC 3161 timestamp (spec §7.4 / D16).',
      style:
        'display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:#2fae8f;background:rgba(47,174,143,0.12);border:1px solid rgba(47,174,143,0.35)',
    },
    label,
  );
}

// ---------- psi score (spec D15) ----------

/** Odds against chance, from the test-martingale wealth (the e-value). */
export function fmtOdds(wealth: number): string {
  if (!isFinite(wealth)) return '∞ : 1';
  if (wealth < 1) return 'below chance';
  if (wealth < 1e6) return `${Math.round(wealth).toLocaleString('en-US')} : 1`;
  return `${wealth.toExponential(1)} : 1`;
}

/** A tier chip; the "candidate" modifier glows. */
export function psiBadge(psi: PsiScore): HTMLElement {
  return el(
    'span',
    { class: `psi-badge tier-${psi.tier}${psi.isCandidate ? ' candidate' : ''}` },
    psi.isCandidate ? `${psi.tierName} ★` : psi.tierName,
  );
}

/** Progress bar toward the candidate threshold (30 pts = 10·log10(1000)). */
export function psiLadder(psi: PsiScore): HTMLElement {
  const candidatePoints = 30;
  const pct = Math.max(0, Math.min(100, (psi.points / candidatePoints) * 100));
  return el('div', { class: 'psi-ladder' }, [
    el('div', { class: 'psi-bar' }, el('div', { class: `psi-fill${psi.isCandidate ? ' candidate' : ''}`, style: `width:${pct}%` })),
    el('div', { class: 'psi-ladder-foot faint' }, [
      el('span', {}, `${psi.points} pts`),
      el('span', {}, psi.toNextTier ? `next: ${psi.toNextTier.name} at ${fmtOdds(psi.toNextTier.wealth)}` : 'top tier reached'),
    ]),
  ]);
}

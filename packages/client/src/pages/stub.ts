// Routed placeholders for the remaining Phase 2 sections. The experiments
// browser, leaderboard, and per-operator history all need new server READ
// endpoints over the ledger (aggregate stats + history), which are not built
// yet — see spec §10. These pages keep the site navigable and honest in the
// meantime, and the experiments page already surfaces the real, immutable
// binary-micropk-v1 parameters (spec D13).

import { el } from '../ui';
import { getOperatorPubKey, shortId } from '../identity';

function page(...children: HTMLElement[]): HTMLElement {
  return el('div', { class: 'page' }, children);
}

function comingSoon(reason: string): HTMLElement {
  return el('div', { class: 'callout' }, [
    el('strong', {}, 'Coming soon. '),
    reason,
  ]);
}

export function renderExperiments(outlet: HTMLElement): void {
  const facts = el('dl', { class: 'facts' });
  const rows: Array<[string, string]> = [
    ['trial size', '200 bits → Binomial(200, ½), mean 100, SD ≈ 7.07'],
    ['session', '900 trials · 180,000 bits · 180 seconds'],
    ['intentions', 'HIGH · LOW · BASELINE (tripolar)'],
    ['conditioning', 'none — raw, unconditioned bits'],
    ['headline contrast', 'HIGH − LOW (cancels static bias)'],
  ];
  for (const [k, v] of rows) facts.append(el('dt', {}, k), el('dd', {}, v));

  outlet.append(
    page(
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Experiments'),
        el('h1', {}, 'Available experiments'),
      ]),
      el('div', { class: 'card' }, [
        el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px' }, [
          el('h2', { style: 'margin:0;font-size:18px' }, 'Binary micro-PK'),
          el('span', { class: 'badge' }, 'binary-micropk · v1'),
          el('span', { class: 'badge good dot' }, 'live'),
        ]),
        el('p', { class: 'dim', style: 'margin:0 0 16px' },
          'Try to bias a stream of truly random bits away from a fair 50/50 by intention alone. The benchmark micro-PK protocol, anchored to the PEAR REG parameters.'),
        facts,
        el('div', { style: 'margin-top:18px' }, [
          el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run this experiment'),
        ]),
      ]),
      el('p', { class: 'faint', style: 'margin-top:20px' },
        'Next: two-color precognition — choose a color before the target is derived from a future public beacon (spec §7.5).'),
      comingSoon('Per-experiment aggregate stats and history land once the ledger read API is in place.'),
    ),
  );
}

export function renderLeaderboard(outlet: HTMLElement): void {
  outlet.append(
    page(
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Leaderboard'),
        el('h1', {}, 'Aggregate & leaderboard'),
      ]),
      el('div', { class: 'callout warn' }, [
        el('strong', {}, 'Read this first. '),
        'With enough sessions, extreme-looking runs are guaranteed by chance even with no real effect. The leaderboard is an engagement feature, not evidence — the science is the pre-registered aggregate against a calibrated null. ',
        el('a', { href: '/about', 'data-link': true }, 'Why a single result isn’t proof'),
        '.',
      ]),
      comingSoon('The honest aggregate view (effect sizes vs the calibrated baseline, anomaly counts, leave-one-operator-out) needs the aggregate-stats API over the ledger.'),
    ),
  );
}

export function renderHistory(outlet: HTMLElement): void {
  const who = el('span', { class: 'mono' }, '…');
  void getOperatorPubKey()
    .then((pub) => { who.textContent = `${shortId(pub)}…`; })
    .catch(() => { who.textContent = 'unavailable'; });

  outlet.append(
    page(
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Your history' ),
        el('h1', {}, 'Your sessions'),
      ]),
      el('p', { class: 'dim' }, [
        'Tied to your in-browser operator key ',
        who,
        ' — pseudonymous, no account, no personal data (spec D6).',
      ]),
      comingSoon('Your run history appears here once the per-operator history API over the ledger is built. Until then, the seal summary at the end of each run is your record — screenshot the anchor.'),
    ),
  );
}

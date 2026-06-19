// Leaderboard / aggregate view (spec §10, section 3) — honest by construction:
// the D4 caveat leads, anomaly counts are shown against the counts chance alone
// predicts, and the "extremes" list is explicitly framed as expected-by-chance.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchStats, type GlobalStats, type SessionSummary } from '../api';
import { loading, errorBox, stat, fmtZ, shortKey } from '../widgets';

export function renderLeaderboard(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Leaderboard'),
        el('h1', {}, 'Aggregate & leaderboard'),
      ]),
      el('p', { class: 'section-lede' },
        'Live totals across the influence (binary micro-PK) experiment. As more experiments come online, each will report its own aggregate here.'),
      el('div', { class: 'callout warn' }, [
        el('strong', {}, 'Read this first. '),
        'With enough sessions, extreme-looking runs are guaranteed by chance even with no real effect. This page is for engagement and transparency — it is not evidence. The science is the pre-registered aggregate against a calibrated null (',
        el('a', { href: '/about', 'data-link': true }, 'why'),
        ').',
      ]),
      body,
    ]),
  );

  void fetchStats()
    .then((s) => { if (!disposed) body.replaceChildren(...render(s)); })
    .catch((e) => { if (!disposed) body.replaceChildren(errorBox(e)); });

  return () => { disposed = true; };
}

function render(s: GlobalStats): HTMLElement[] {
  const overview = el('div', { class: 'card' }, [
    el('div', { class: 'stat-row' }, [
      stat(String(s.sealed), 'sealed sessions'),
      stat(s.totalBits.toLocaleString(), 'bits generated'),
      // Mean display-z per committed choice, over whatever vocabulary the corpus holds.
      ...Object.entries(s.byChoice).map(([choice, st]) => stat(fmtZ(st.meanZ), `${choice} mean z`)),
      ...(s.highMinusLow !== null ? [stat(fmtZ(s.highMinusLow), 'HIGH − LOW')] : []),
    ]),
  ]);

  const anomalies = el('div', { class: 'card' }, [
    el('h2', { style: 'margin:0 0 10px;font-size:16px' }, 'Anomaly counts vs chance'),
    el('p', { class: 'dim', style: 'margin:0 0 6px' }, [
      el('b', {}, String(s.anomalies.z2)), ' sessions beyond |z| > 2 ',
      el('span', { class: 'faint' }, `(~${s.anomalies.expectedZ2.toFixed(1)} expected by chance)`),
    ]),
    el('p', { class: 'dim', style: 'margin:0' }, [
      el('b', {}, String(s.anomalies.z3)), ' sessions beyond |z| > 3 ',
      el('span', { class: 'faint' }, `(~${s.anomalies.expectedZ3.toFixed(2)} expected by chance)`),
    ]),
  ]);

  const extremes = el('div', { class: 'card' }, [
    el('h2', { style: 'margin:0 0 4px;font-size:16px' }, 'Most extreme sessions'),
    el('p', { class: 'faint', style: 'margin:0 0 12px' },
      'Largest |z| so far — expected by chance, shown for transparency, not as evidence.'),
    s.extremes.length ? table(s.extremes) : el('p', { class: 'dim' }, 'No sealed sessions yet.'),
  ]);

  return [overview, anomalies, extremes];
}

function table(rows: SessionSummary[]): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  rows.forEach((r, i) => {
    wrap.append(
      el('a', { class: 'rowlink', href: `/verify?session=${r.sessionId}`, 'data-link': true }, [
        el('span', { class: 'rank' }, `#${i + 1}`),
        el('span', { class: 'mono anchorcell' }, r.anchor),
        el('span', { class: 'badge' }, r.choice || '—'),
        el('span', { class: `z ${Math.abs(r.zDisplay ?? 0) > 2 ? 'warn' : ''}` }, fmtZ(r.zDisplay)),
        el('span', { class: 'faint mono' }, shortKey(r.operatorPubKey)),
        el('span', { class: 'go' }, 'verify →'),
      ]),
    );
  });
  return wrap;
}

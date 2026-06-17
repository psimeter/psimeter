// Experiments browser (spec §10, section 2): real per-experiment session counts
// from the ledger read API, the immutable parameters (D13), and a run link.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchExperiments, type ExperimentInfo } from '../api';
import { loading, errorBox, stat } from '../widgets';

export function renderExperiments(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Experiments'),
        el('h1', {}, 'Available experiments'),
      ]),
      body,
    ]),
  );

  void fetchExperiments()
    .then((exps) => {
      if (disposed) return;
      const cards: HTMLElement[] = exps.map(card);
      cards.push(
        el('p', { class: 'faint', style: 'margin-top:6px' },
          'Next: two-color precognition — choose a color before the target is derived from a future public beacon (spec §7.5).'),
      );
      body.replaceChildren(...cards);
    })
    .catch((e) => { if (!disposed) body.replaceChildren(errorBox(e)); });

  return () => { disposed = true; };
}

function card(d: ExperimentInfo): HTMLElement {
  const p = d.params as Record<string, number | string>;
  const facts = el('dl', { class: 'facts' });
  const rows: Array<[string, string]> = [
    ['trial', `${p.trialBits} bits`],
    ['session', `${p.trialsPerSession} trials · ${Number(p.bitsPerSession).toLocaleString()} bits · ${p.sessionSeconds}s`],
    ['conditioning', String(p.conditioning)],
  ];
  for (const [k, v] of rows) facts.append(el('dt', {}, k), el('dd', {}, v));

  return el('div', { class: 'card' }, [
    el('div', { class: 'row-between' }, [
      el('div', { class: 'row', style: 'gap:10px;align-items:center' }, [
        el('h2', { style: 'margin:0;font-size:18px' }, d.title),
        el('span', { class: 'badge' }, `${d.id} · v${d.version}`),
      ]),
      el('span', { class: 'badge good dot' }, 'live'),
    ]),
    el('div', { class: 'stat-row', style: 'margin:16px 0' }, [
      stat(String(d.stats.sealed), 'sessions'),
      stat(String(d.stats.byIntention.HIGH), 'HIGH'),
      stat(String(d.stats.byIntention.LOW), 'LOW'),
      stat(String(d.stats.byIntention.BASELINE), 'BASELINE'),
    ]),
    facts,
    el('div', { style: 'margin-top:16px' },
      el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run this experiment')),
  ]);
}

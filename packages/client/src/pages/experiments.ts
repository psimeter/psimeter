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
        el('span', { class: 'eyebrow' }, 'Play'),
        el('h1', {}, 'Choose an experiment'),
      ]),
      el('p', { class: 'section-lede' },
        'Each experiment is a different way to test the same question: can your mind nudge — or sense — something genuinely random? Pick one that appeals to you and give it a go. New to this? Either one is a fine place to start.'),
      body,
    ]),
  );

  void fetchExperiments()
    .then((exps) => {
      if (disposed) return;
      body.replaceChildren(...exps.map(card));
    })
    .catch((e) => { if (!disposed) body.replaceChildren(errorBox(e)); });

  return () => { disposed = true; };
}

function card(d: ExperimentInfo): HTMLElement {
  const runHref = `/run?experiment=${encodeURIComponent(d.id)}&v=${d.version}`;
  return el('div', { class: 'card' }, [
    el('div', { class: 'row-between' }, [
      el('h2', { style: 'margin:0;font-size:18px' }, d.title),
      el('span', { class: 'badge good dot' }, 'live'),
    ]),
    el('div', { class: 'stat-row', style: 'margin:16px 0' }, [
      stat(String(d.stats.sealed), 'sessions'),
      // Per-choice counts over the definition's own vocabulary (kind-agnostic).
      ...d.choices.map((c) => stat(String(d.stats.byChoice[c] ?? 0), c)),
    ]),
    facts(d),
    el('div', { style: 'margin-top:16px' },
      el('a', { class: 'btn primary', href: runHref, 'data-link': true }, 'Run this experiment')),
  ]);
}

/** The immutable, content-hashed parameters (D13), summarised per kind. */
function facts(d: ExperimentInfo): HTMLElement {
  const p = d.params as Record<string, number | string>;
  const dl = el('dl', { class: 'facts' });
  const rows: Array<[string, string]> =
    d.kind === 'micro-pk-binary'
      ? [
          ['trial', `${p.trialBits} bits`],
          ['session', `${p.trialsPerSession} trials · ${Number(p.bitsPerSession).toLocaleString()} bits · ${p.sessionSeconds}s`],
          ['conditioning', String(p.conditioning)],
        ]
      : d.kind === 'precognition-presentiment'
        ? [
            ['trial', `1 of ${p.optionsPerTrial} options`],
            ['session', `${p.trialsPerSession} trials · ${p.sessionSeconds}s`],
            ['target', 'a future public draw'],
          ]
        : Object.entries(p).map(([k, v]) => [k, String(v)] as [string, string]);
  for (const [k, v] of rows) dl.append(el('dt', {}, k), el('dd', {}, v));
  return dl;
}

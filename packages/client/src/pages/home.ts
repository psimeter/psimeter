// Landing page: a short, honest pitch that routes to the runner and the
// how-it-works explainer, and states the central design rule up front.

import { el } from '../ui';

export function renderHome(outlet: HTMLElement): void {
  outlet.append(
    el('div', { class: 'page' }, [
      el('section', { class: 'hero' }, [
        el('span', { class: 'eyebrow' }, 'Open · auditable · outcome-neutral'),
        el('h1', {}, 'Can the mind nudge a random number generator?'),
        el('p', { class: 'lede' },
          'PsyMeter is a large-scale, anonymous experiment in mind–matter interaction — built so that anyone can verify every result without trusting the people running it.'),
        el('div', { class: 'cta-row' }, [
          el('a', { class: 'btn primary lg', href: '/run', 'data-link': true }, 'Run a session'),
          el('a', { class: 'btn lg', href: '/about', 'data-link': true }, 'How it works'),
        ]),
      ]),
      el('div', { class: 'pillars' }, [
        pillar('◆', 'Pre-committed',
          'Your intention and the exact parameters are frozen and signed before any randomness exists. Nothing can be changed after the fact.'),
        pillar('→', 'One-way',
          'The generator reads nothing from your screen. The feed is receive-only, so the page cannot bias the stream.'),
        pillar('✓', 'Verifiable',
          'Every session lands in a tamper-evident ledger with public raw data. Re-run the analysis yourself and get identical numbers.'),
      ]),
      el('p', {
        class: 'faint',
        style: 'text-align:center;margin:34px auto 0;max-width:62ch',
      },
        'A single session is just for fun — it is never evidence. The science is the pre-registered aggregate across many people and many runs.'),
    ]),
  );
}

function pillar(ico: string, title: string, body: string): HTMLElement {
  return el('div', { class: 'pillar card' }, [
    el('div', { class: 'ico' }, ico),
    el('h3', {}, title),
    el('p', {}, body),
  ]);
}

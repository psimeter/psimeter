// Guide (spec §10) — a calm, actionable protocol for someone who suspects they
// have a real ability and wants to test it seriously, without drowning in the
// methodology. Linked from /about, /faq, and the candidate contact card. The
// session-count brackets are derived from the psi-score martingale (see
// packages/core/src/psi.ts): how many declared-direction sessions it takes for
// the e-value to clear the candidate threshold, given a sustained real effect.

import { el } from '../ui';
import type { Child } from '../ui';

interface Step { n: string; title: string; body: Child[]; }

const STEPS: Step[] = [
  {
    n: '1',
    title: 'Pick one experiment and commit to it',
    body: [
      'Depth beats breadth. Choose the one that resonates: ',
      el('strong', {}, 'Influence'),
      ' (push the random bits HIGH or LOW) or ',
      el('strong', {}, 'Foresight'),
      ' (sense an image\'s feeling before it appears). Unsure? Start with ',
      el('strong', {}, 'presentiment'),
      ' — it reaches a clear signal in far fewer sessions, and its statistics are the cleanest.',
    ],
  },
  {
    n: '2',
    title: 'Use the same key every time',
    body: [
      'Your psi score lives on the operator key in this browser. Don\'t clear your storage, switch to incognito, or mint a fresh key to “start over” — you\'d lose your history, and quietly fishing across many keys for a lucky one is exactly how people fool themselves. One identity, accumulating honestly.',
    ],
  },
  {
    n: '3',
    title: 'For micro-PK: balance HIGH and LOW',
    body: [
      'Alternate your two intentions roughly evenly. The headline measure is the ',
      el('strong', {}, 'difference'),
      ' between them, which cancels any fixed quirk of the hardware — so only your mind can move it. Running only HIGH leaves your score open to a boring, non-psi explanation. (Presentiment has no such requirement — its chance rate is an exact coin flip.)',
    ],
  },
  {
    n: '4',
    title: 'Do many sessions — and judge by the score, not a run',
    body: [
      'A few minutes of data carries almost no signal; repetition is the entire point. Ignore the live wiggle and any single hot result, and watch the ',
      el('strong', {}, 'psi score'),
      '. Under pure chance it stays near 0 forever; it only trends upward if something real is moving outcomes your way, over and over.',
    ],
  },
  {
    n: '5',
    title: 'Keep your conditions stable',
    body: [
      'Same routine, same headspace, similar effort each time. You\'re testing a ',
      el('em', {}, 'stable'),
      ' ability, so give it a stable chance to appear — and consistency between your earlier and later sessions (split-half reliability) is part of how a real effect is told apart from a fluke.',
    ],
  },
  {
    n: '6',
    title: 'If you reach Candidate, that\'s the starting line',
    body: [
      'Crossing the threshold doesn\'t prove anything by itself — it flags you for the real test: a fresh, ',
      el('strong', {}, 'pre-registered, fixed-N replication'),
      ' agreed in advance. If you want to take that step, the optional contact form on your ',
      el('a', { href: '/profile', 'data-link': true }, 'profile'),
      ' lets you reach the researcher. It\'s the one place you choose to step out of anonymity.',
    ],
  },
];

interface Row { exp: string; effect: string; sessions: string; time: string; }
const TABLE: Row[] = [
  { exp: 'Presentiment', effect: 'Strong (~65% hits)', sessions: '~10–15', time: '~30 min' },
  { exp: 'Presentiment', effect: 'Moderate (~60%)', sessions: '~20–30', time: '~1 hour' },
  { exp: 'Presentiment', effect: 'Subtle (~55%)', sessions: '~70–90', time: '~3 hours' },
  { exp: 'Micro-PK', effect: 'Strong, sustained', sessions: '~70–150', time: 'a few hours' },
  { exp: 'Micro-PK', effect: 'Textbook-tiny', sessions: '~1,000+', time: 'many hours' },
];

export function renderGuide(outlet: HTMLElement): void {
  outlet.append(
    el('div', { class: 'page about guide' }, [
      el('header', { class: 'about-hero' }, [
        el('span', { class: 'eyebrow' }, 'The guide'),
        el('h1', {}, 'So you want to find out if it’s real'),
        el('p', { class: 'lede' },
          'A short, practical protocol for testing your own ability properly — without getting lost in the methodology. If you only skim one thing on this site, make it this.'),
        el('p', { class: 'rule' },
          'Be warned, kindly: most people\'s scores sit near 0 forever. That isn\'t the experiment failing — it\'s the experiment working. A real ability is the rare exception that keeps compounding.'),
      ]),

      el('h2', { class: 'about-h2' }, 'The protocol'),
      el('div', { class: 'guide-steps' }, STEPS.map((s) =>
        el('div', { class: 'guide-step card' }, [
          el('div', { class: 'n' }, s.n),
          el('div', {}, [
            el('h3', {}, s.title),
            el('p', {}, s.body),
          ]),
        ]))),

      el('h2', { class: 'about-h2' }, 'How many sessions does it actually take?',),
      el('p', { class: 'section-lede' },
        'It depends entirely on how strong — and how real — your effect is. These brackets are what it takes for the psi score to reach the Candidate threshold (1000-to-1 odds), assuming a genuine, sustained effect. If there\'s no real effect, no number of sessions will get you there, and that is the honest answer.'),
      el('div', { class: 'guide-table-wrap' }, [
        el('table', { class: 'guide-table' }, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, 'Experiment'),
            el('th', {}, 'If your effect is…'),
            el('th', {}, 'Sessions to Candidate'),
            el('th', {}, 'Rough time'),
          ])),
          el('tbody', {}, TABLE.map((r) =>
            el('tr', {}, [
              el('td', {}, el('strong', {}, r.exp)),
              el('td', {}, r.effect),
              el('td', { class: 'tnum' }, r.sessions),
              el('td', { class: 'faint' }, r.time),
            ]))),
        ]),
      ]),
      el('p', { class: 'section-lede' },
        'The takeaway: if you suspect a strong, noticeable ability, presentiment can give you an answer in an afternoon. Micro-PK is a longer game built for scale — the textbook effect is so small that only large numbers of sessions can reveal it.'),

      el('div', { class: 'callout closing' }, [
        'Ready? Pick one experiment and start your run of sessions — your score is waiting at 0. ',
        el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run a session →'),
        el('a', { class: 'btn', href: '/faq', 'data-link': true, style: 'margin-left:10px' }, 'Read the FAQ'),
      ]),
    ]),
  );
}

// About / how it works (spec §10, section 1).
//
// The skeptic's on-ramp: what PsyMeter tests, and — the part that matters — how
// the cryptography lets anyone verify a result without trusting the experimenter.
// A readable summary of spec §2 and §7, not the paper.

import { el } from '../ui';
import type { Child } from '../ui';

interface Step { n: string; title: string; body: Child[]; }

const CHAIN: Step[] = [
  {
    n: '1',
    title: 'Commit before any randomness exists',
    body: [
      'You pick a direction. Before generating a single bit, the server freezes your choice, the exact experiment parameters, your public key, and a fresh public-randomness value into one hash — the ',
      el('strong', {}, 'pre-commitment'),
      ' — and shows you a short fingerprint of it: the ',
      el('strong', {}, 'anchor'),
      '. Your browser signs the pre-commitment with a key only you hold. The experimenter can now never change what you committed to, and you can never deny it.',
    ],
  },
  {
    n: '2',
    title: 'Anchor it to a public beacon',
    body: [
      'That fresh value comes from ',
      el('strong', {}, 'drand'),
      ', a public beacon that publishes a new, unpredictable number every few seconds. Because it did not exist until moments before your run, your session provably could not have been pre-computed and cherry-picked from a library of flattering results.',
    ],
  },
  {
    n: '3',
    title: 'Generate in isolation, one-way',
    body: [
      'A separate process pulls raw bits from a physical entropy source and streams them to your screen ',
      el('strong', {}, 'one-way'),
      '. Nothing you do can reach the generator, and nothing the generator does depends on the page. The isolation is structural, not a promise.',
    ],
  },
  {
    n: '4',
    title: 'Pin the data as it is produced',
    body: [
      'Each batch of raw bits is folded into a running ',
      el('strong', {}, 'Merkle commitment'),
      ' — a cryptographic running total. The final value commits to the entire stream, so afterward no bit can be swapped, dropped, or selectively kept. The raw stream itself is saved, addressed by its own hash.',
    ],
  },
  {
    n: '5',
    title: 'Seal into a tamper-evident ledger',
    body: [
      'The finished session is appended to a ',
      el('strong', {}, 'hash-chained log'),
      ': every entry embeds the hash of the previous one. The head of the chain is periodically anchored to an independent timestamp, so nothing can be inserted, reordered, deleted, or backdated without visibly breaking the chain.',
    ],
  },
  {
    n: '6',
    title: 'Reproduce the analysis yourself',
    body: [
      'All raw data and a deterministic analysis script are public. Anyone re-runs ',
      el('code', {}, 'analysis/analyze.py'),
      ' and gets identical numbers. The "z" you see during a run is ',
      el('strong', {}, 'display only'),
      ' — the authoritative statistics are computed independently, never by the live server.',
    ],
  },
];

export function renderAbout(outlet: HTMLElement): void {
  const steps = el('div', { class: 'steps' });
  for (const s of CHAIN) {
    steps.append(
      el('div', { class: 'step' }, [
        el('div', { class: 'n' }, s.n),
        el('div', { class: 'body' }, [
          el('h3', {}, s.title),
          el('p', {}, s.body),
        ]),
      ]),
    );
  }

  outlet.append(
    el('div', { class: 'page prose' }, [
      el('span', { class: 'eyebrow' }, 'How it works'),
      el('h1', {}, 'You don’t have to trust us'),
      el('p', { class: 'lede' },
        'PsyMeter tests a simple, old, and controversial question: can a person, by intention alone, nudge the output of a truly random process — or anticipate one before it happens? Claims like these live or die on their methodology. So the whole platform is built around one rule: the experimenter is treated as an untrusted party, and every result is verifiable from public artifacts by a skeptic who trusts no one.'),

      el('h2', {}, 'The chain of evidence'),
      el('p', {},
        'Every session walks the same path. Each step removes a way the experimenter could cheat or fool themselves:'),
      steps,

      el('div', { class: 'callout' }, [
        el('strong', {}, 'The anchor is the heart of it. '),
        'It is the short fingerprint of everything you committed to before the randomness existed. Screenshot it: it is your independent proof of exactly what you predicted, when. During a run it is also your concentration target — the thing you hold in mind.',
      ]),

      el('h2', {}, 'What a result means — and what it doesn’t'),
      el('p', {},
        'This is where most psi claims go wrong, so we are blunt about it. With millions of sessions, extreme-looking individual runs are guaranteed by chance, even if no effect exists at all. A single high-scoring session is therefore '),
      el('p', {}, [
        el('strong', {}, 'not evidence of anything. '),
        'A 3-minute session contributes a vanishingly small signal even under the textbook psi effect size. All real inference lives in aggregation across many sessions and operators, in a ',
        el('strong', {}, 'pre-registered'),
        ' test fixed in advance — never in a result picked out after the fact.',
      ]),
      el('ul', {}, [
        el('li', {}, [el('strong', {}, 'The leaderboard is engagement, not proof. '), 'It exists to make participating fun; it is not the science.']),
        el('li', {}, [el('strong', {}, 'We compare against a calibrated null. '), 'Not a textbook coin, but the generator’s own measured behavior from large operator-absent control runs.']),
        el('li', {}, [el('strong', {}, 'The headline is the HIGH − LOW difference. '), 'Comparing your two intentions cancels any fixed quirk of the hardware; only the intention differs.']),
        el('li', {}, [el('strong', {}, 'No single person can drive the result. '), 'The pre-registered analysis caps any one operator and re-checks the corpus with each heavy user left out.']),
      ]),

      el('h2', {}, 'Where the randomness comes from'),
      el('p', {},
        'Only a genuinely physical process can, even in principle, be nudged moment-to-moment. PsyMeter is built around a ladder of sources, and every session records exactly which one produced it:'),
      el('ul', {}, [
        el('li', {}, [el('code', {}, 'os'), ' — the operating system’s generator. Plumbing for tests only; clearly marked non-confirmatory.']),
        el('li', {}, [el('code', {}, 'rdseed'), ' — your CPU’s on-chip thermal-noise source. Real physical entropy, good for piloting.']),
        el('li', {}, ['open-hardware USB and quantum sources — the auditable, citable targets for confirmatory data collection.']),
      ]),

      el('h2', {}, 'Your identity'),
      el('p', {},
        'When you first open the site, your browser generates a random keypair and keeps it locally. It carries no name, email, or personal data — it simply lets you accumulate sessions and return, and it signs each run as yours. Clear your browser storage and that pseudonym is gone.'),

      el('div', { class: 'callout' }, [
        'PsyMeter is open source — protocol, code, pre-registration, and (eventually) the full raw dataset. The point is not to be believed. The point is to be ',
        el('strong', {}, 'checked'),
        '. Ready to try it? ',
        el('a', { href: '/run', 'data-link': true }, 'Run a session'),
        '.',
      ]),
    ]),
  );
}

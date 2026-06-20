// About / how it works (spec §10, section 1) — the friendly, plain-language
// explainer for a curious stranger. The detailed Q&A and the full methodology
// live on the FAQ (/faq); the actionable protocol for someone who wants to
// seriously test their own ability lives on the Guide (/guide).

import { el } from '../ui';
import type { Child } from '../ui';

interface Step { n: string; title: string; body: Child[]; }

const CHAIN: Step[] = [
  {
    n: '1',
    title: 'Commit before any randomness exists',
    body: [
      'You make your call — the direction you intend to push, or the target you predict. Before any randomness exists, the server freezes your choice, the exact parameters, your public key, and a fresh public-randomness value into one hash — the ',
      el('strong', {}, 'pre-commitment'),
      ' — and shows you a short fingerprint of it: the ',
      el('strong', {}, 'anchor'),
      '. Your browser signs it with a key only you hold. The experimenter cannot alter what you chose, and you cannot deny it.',
    ],
  },
  {
    n: '2',
    title: 'Anchor it to a public beacon',
    body: [
      'That fresh value comes from ',
      el('strong', {}, 'drand'),
      ', a public beacon that publishes a new, unpredictable value every few seconds. Because it didn\'t exist until moments before your run, your session cannot have been precomputed or cherry-picked from a pool of favourable results.',
    ],
  },
  {
    n: '3',
    title: 'Generate in isolation, one-way',
    body: [
      'A separate process pulls raw bits from a physical entropy source and streams them to your screen ',
      el('strong', {}, 'one-way'),
      '. Nothing you do can reach the generator. The isolation is structural, not a promise.',
    ],
  },
  {
    n: '4',
    title: 'Pin the data as it is produced',
    body: [
      'Each batch of raw bits is folded into a running ',
      el('strong', {}, 'Merkle commitment'),
      '. The final value commits to the entire stream, so afterward no bit can be swapped, dropped, or selectively kept. The raw stream itself is saved, addressed by its own hash.',
    ],
  },
  {
    n: '5',
    title: 'Seal into a tamper-evident ledger',
    body: [
      'The finished session is appended to a ',
      el('strong', {}, 'hash-chained log'),
      ' whose head is periodically anchored to an independent timestamp (OpenTimestamps → Bitcoin). Nothing can be inserted, reordered, deleted, or backdated without visibly breaking the chain.',
    ],
  },
  {
    n: '6',
    title: 'Reproduce the analysis yourself',
    body: [
      'All raw data and a deterministic analysis script are public. Anyone re-runs ',
      el('code', {}, 'analysis/analyze.py'),
      ' and gets identical numbers. The score you see during a run is ',
      el('strong', {}, 'display only'),
      ' — the authoritative statistics are computed independently, never by the live server.',
    ],
  },
];

interface Tldr { ico: string; title: string; body: string; }
const TLDR: Tldr[] = [
  { ico: '🎯', title: 'What you do', body: 'It depends on the experiment: push a live stream of random bits up or down by intention, or call a target before it exists. Either way you lock your choice in first, then watch the run unfold against what chance predicts.' },
  { ico: '🔬', title: 'The question', body: 'Whether intention alone can shift the output of a genuinely physical random process — or let you anticipate one. Researchers have studied it seriously for decades, with mixed and hotly debated results. We run the tests in public, with all data available.' },
  { ico: '🔒', title: 'Why you can trust it', body: 'You don\'t need to take our word for it. Every result is sealed before any randomness is generated, and anyone can verify it independently from the public data — including people who assume we\'re lying.' },
  { ico: '⚖️', title: 'What a result means', body: 'A single good run is almost certainly luck — extreme results happen by chance all the time. The real signal is whether a person beats chance, in the direction they declared, again and again.' },
];

export function renderAbout(outlet: HTMLElement): void {
  outlet.append(
    el('div', { class: 'page about' }, [
      // ---- header --------------------------------------------------------
      el('header', { class: 'about-hero' }, [
        el('span', { class: 'eyebrow' }, 'How it works'),
        el('h1', {}, 'You don’t have to trust us'),
        el('p', { class: 'lede' },
          'PsyMeter tests a question researchers have argued about for decades: can a person, by intention alone, shift the output of a genuinely random process — or anticipate one? Claims like this have a long history of not surviving scrutiny. So the platform is built around one principle:'),
        el('p', { class: 'rule' },
          'The experimenter is treated as an untrusted party, and every result is verifiable from public data by a skeptic who trusts no one.'),
        el('div', { class: 'audience-hint' }, [
          el('span', {}, ['New here? Read on — this page is the plain-English tour.']),
          el('span', {}, ['Want the details, the studies, or to poke holes? → ', el('a', { href: '/faq', 'data-link': true }, 'the FAQ'), '.']),
          el('span', {}, ['Want to seriously test your own ability? → ', el('a', { href: '/guide', 'data-link': true }, 'the guide'), '.']),
        ]),
      ]),

      // ---- TL;DR ---------------------------------------------------------
      el('h2', { class: 'about-h2' }, 'The short version'),
      el('div', { class: 'tldr-grid' }, TLDR.map((t) =>
        el('div', { class: 'tldr card' }, [
          el('div', { class: 'tldr-ico' }, t.ico),
          el('h3', {}, t.title),
          el('p', {}, t.body),
        ]))),

      // ---- the family of experiments ------------------------------------
      el('h2', { class: 'about-h2' }, 'One platform, many experiments'),
      el('p', { class: 'section-lede' },
        'PsyMeter isn\'t a single test — it\'s a growing set of experiments, each probing the same question from a different direction. They fall into two families:'),
      el('div', { class: 'twocol' }, [
        el('div', { class: 'card' }, [
          el('h3', {}, 'Influence — micro-psychokinesis'),
          el('p', {}, [
            'You try to bias a live physical random process while it runs. ',
            el('strong', {}, 'Binary micro-PK'),
            ' is live: choose HIGH or LOW and hold it in mind while a stream of random bits is generated; the feed shows whether the running total drifts your way.',
          ]),
        ]),
        el('div', { class: 'card' }, [
          el('h3', {}, 'Foresight — forced-choice precognition'),
          el('p', {}, [
            'You commit a choice ',
            el('em', {}, 'before'),
            ' the target exists. ',
            el('strong', {}, 'Presentiment'),
            ' is live: each trial you sense whether a calm or an unpleasant image is coming — bound to a future beacon round that hasn\'t been published yet — then the real image appears and you see if you called it.',
          ]),
        ]),
      ]),
      el('p', { class: 'section-lede' },
        'Whatever the task, the same trust machinery wraps every experiment, and each has its own pre-registered analysis. Here is the sequence that protects each run:'),

      // ---- chain of evidence --------------------------------------------
      el('h2', { class: 'about-h2' }, 'How a session works'),
      el('p', { class: 'section-lede' },
        'Every session — in any experiment — follows the same sequence. Each step closes off a way the result could be manipulated, by the experimenter or anyone else:'),
      el('div', { class: 'chain-grid' }, CHAIN.map((s) =>
        el('div', { class: 'chain-card card' }, [
          el('div', { class: 'n' }, s.n),
          el('h3', {}, s.title),
          el('p', {}, s.body),
        ]))),

      el('div', { class: 'callout big-callout' }, [
        el('div', { class: 'callout-mark' }, '◎'),
        el('div', {}, [
          el('strong', {}, 'The anchor. '),
          'A short fingerprint of everything you committed to before any randomness existed. Screenshot it — it\'s your independent record of exactly what you predicted and when, verifiable without the server. During the run, it\'s also your focus target.',
        ]),
      ]),

      // ---- what a result means ------------------------------------------
      el('h2', { class: 'about-h2' }, 'What a result means — and what it doesn\'t'),
      el('p', { class: 'section-lede' },
        'This is where most psi claims go wrong. With many sessions in the database, extreme-looking individual runs are guaranteed by chance. The question is never one run — it\'s whether someone does it consistently.'),
      el('div', { class: 'twocol' }, [
        el('div', { class: 'col-bad card' }, [
          el('h3', {}, ['✕ ', 'Not evidence']),
          el('ul', {}, [
            el('li', {}, [el('strong', {}, 'A single hot session. '), 'Even under the textbook psi effect size, a few minutes carries a vanishingly small signal. A high score is a fun moment, nothing more.']),
            el('li', {}, [el('strong', {}, 'Topping the leaderboard once. '), 'Across thousands of players, someone will look gifted by pure chance. That\'s exactly why a “candidate” has to replicate before anything is claimed.']),
            el('li', {}, [el('strong', {}, 'A result picked after the fact. '), 'Cherry-picking from a sea of runs proves nothing; the test must be fixed in advance.']),
          ]),
        ]),
        el('div', { class: 'col-good card' }, [
          el('h3', {}, ['✓ ', 'Where the signal lives']),
          el('ul', {}, [
            el('li', {}, [el('strong', {}, 'Consistency, measured honestly. '), 'Your ', el('a', { href: '/faq', 'data-link': true }, 'psi score'), ' only climbs if you beat chance in your declared direction, repeatedly. Under pure luck it stays near zero no matter how long you play.']),
            el('li', {}, [el('strong', {}, 'A candidate who replicates. '), 'Crossing the threshold flags you for a separate, pre-registered, fixed-N test. The replication is the proof — not the flag.']),
            el('li', {}, [el('strong', {}, 'The pre-registered aggregate. '), 'Across many sessions, against the generator\'s own measured baseline — never a result spotted afterward.']),
          ]),
        ]),
      ]),

      // ---- go deeper -----------------------------------------------------
      el('h2', { class: 'about-h2' }, 'Go deeper'),
      el('div', { class: 'twocol' }, [
        el('a', { class: 'card linkcard', href: '/faq', 'data-link': true }, [
          el('h3', {}, 'The FAQ →'),
          el('p', {}, 'Straight answers about the system, the methodology in full, the psi score, and what the actual research does and doesn\'t show — with references.'),
        ]),
        el('a', { class: 'card linkcard', href: '/guide', 'data-link': true }, [
          el('h3', {}, 'The guide →'),
          el('p', {}, 'Think you might have a real ability? A calm, step-by-step protocol: which experiment to pick, how to run it properly, and how many sessions it actually takes.'),
        ]),
      ]),

      // ---- identity ------------------------------------------------------
      el('h2', { class: 'about-h2' }, 'Your identity'),
      el('p', { class: 'section-lede single' },
        'When you first open the site, your browser generates a random keypair and keeps it locally. It carries no name, email, or personal data — it simply lets you accumulate sessions and return, and it signs each run as yours. Clear your browser storage and that pseudonym is gone forever.'),

      el('div', { class: 'callout closing' }, [
        'PsyMeter is open source — protocol, code, pre-registration, and (eventually) the full raw dataset. The point is not to be believed. The point is to be ',
        el('strong', {}, 'checked'),
        '. Ready to try it? ',
        el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run an experiment →'),
      ]),
    ]),
  );
}

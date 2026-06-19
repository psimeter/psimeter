// About / how it works (spec §10, section 1).
//
// Two jobs, one page (the §10 brief):
//   1. A friendly TL;DR for a curious stranger who is not a scientist.
//   2. A genuine reference for a skeptic or scientist who wants to poke holes —
//      the methodology, the threat model, the hypotheses, and how to verify it
//      yourself from public artifacts.
// Laid out wide (not a narrow column) so the page breathes on a desktop.

import { el } from '../ui';
import type { Child } from '../ui';

interface Step { n: string; title: string; body: Child[]; }

const CHAIN: Step[] = [
  {
    n: '1',
    title: 'Commit before any randomness exists',
    body: [
      'You make your call — the direction you intend to push, or the target you predict, depending on the experiment. Before any randomness exists, the server freezes your choice, the exact experiment parameters, your public key, and a fresh public-randomness value into one hash — the ',
      el('strong', {}, 'pre-commitment'),
      ' — and shows you a short fingerprint of it: the ',
      el('strong', {}, 'anchor'),
      '. Your browser signs the pre-commitment with a key only you hold. The experimenter cannot alter what you chose, and you cannot deny having chosen it — the signature proves both.',
    ],
  },
  {
    n: '2',
    title: 'Anchor it to a public beacon',
    body: [
      'That fresh value comes from ',
      el('strong', {}, 'drand'),
      ', a public randomness beacon that publishes a new, unpredictable value every few seconds (we verify its BLS signature in-process). Because it didn\'t exist until moments before your run, your session cannot have been precomputed or selected from a pool of favorable results.',
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
      ': every entry embeds the hash of the previous one, and the head is periodically anchored to an independent timestamp (OpenTimestamps → Bitcoin). Nothing can be inserted, reordered, deleted, or backdated without visibly breaking the chain.',
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

interface Tldr { ico: string; title: string; body: string; }
const TLDR: Tldr[] = [
  { ico: '🎯', title: 'What you do', body: 'It depends on the experiment: push a live stream of random bits up or down by intention, or call a target before it exists. Either way you lock your choice in first, then watch the run unfold against what chance predicts.' },
  { ico: '🔬', title: 'The question', body: 'Whether intention alone can shift the output of a genuinely physical random process — or let you anticipate one. Each experiment is a different angle on that question. Researchers have studied it seriously for decades. We run the tests in public, with all data available.' },
  { ico: '🔒', title: 'Why you can trust it', body: 'You don\'t need to take our word for it. Every result is sealed before any randomness is generated, and anyone can verify it independently from the public data — including people who assume we\'re lying.' },
  { ico: '⚖️', title: 'What a result means', body: 'A single good run is probably luck — extreme results happen by chance all the time. The actual science is the pre-registered aggregate across many sessions, measured against the generator\'s own baseline behavior.' },
];

interface Source { tag: string; name: string; body: string; cls: string; }
const LADDER: Source[] = [
  { tag: 'os', name: 'OS generator', body: 'The operating system’s RNG. Plumbing for tests only — clearly marked non-confirmatory.', cls: '' },
  { tag: 'rdseed', name: 'CPU thermal noise', body: 'Your processor’s on-chip RDSEED entropy. Real physical randomness, good for piloting.', cls: 'mid' },
  { tag: 'TRNG / QRNG', name: 'Open hardware & quantum', body: 'Auditable USB and quantum sources — the citable targets for confirmatory data collection.', cls: 'top' },
];

interface Decision { k: string; v: string; }
const GUARANTEES: Decision[] = [
  { k: 'True physical RNG', v: 'Only a genuinely physical process could, even in principle, be influenced moment-to-moment. The entropy source is recorded for every session.' },
  { k: 'Tripolar protocol', v: 'HIGH / LOW / BASELINE conditions are interleaved. The headline is the HIGH − LOW contrast, which cancels any fixed hardware bias — only intention differs.' },
  { k: 'Fixed N, no optional stopping', v: 'Session length is frozen at commit time. You cannot stop early on a good streak, the classic way to manufacture significance.' },
  { k: 'Pre-registration', v: 'The confirmatory hypotheses, sample size, and analysis script are registered before the data exists. Exploratory findings are never cited as confirmation.' },
  { k: 'Empirically calibrated null', v: 'Results are compared against the generator’s own measured behaviour in large operator-absent control runs — not an assumed perfect coin.' },
  { k: 'Dominant-operator robustness', v: 'The analysis caps any single operator’s weight and re-checks the corpus with each heavy user removed, so no one person (or fraudster) can drive the result.' },
];

export function renderAbout(outlet: HTMLElement): void {
  outlet.append(
    el('div', { class: 'page about' }, [
      // ---- header --------------------------------------------------------
      el('header', { class: 'about-hero' }, [
        el('span', { class: 'eyebrow' }, 'How it works'),
        el('h1', {}, 'You don’t have to trust us'),
        el('p', { class: 'lede' },
          'PsyMeter tests a question that researchers have argued about seriously for decades: can a person, by intention alone, shift the output of a genuinely random process — or anticipate one? Claims in this area have a long history of not surviving scrutiny. So the platform is built around one principle:'),
        el('p', { class: 'rule' },
          'The experimenter is treated as an untrusted party, and every result is verifiable from public artifacts by a skeptic who trusts no one.'),
        el('div', { class: 'audience-hint' }, [
          el('span', {}, ['Reading as someone ', el('strong', {}, 'curious'), '? Start with the cards just below.']),
          el('span', {}, ['Here to ', el('strong', {}, 'poke holes'), '? Skip to ', el('a', { href: '#rigor' }, 'the methodology'), '.']),
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
            'You try to bias a live physical random process while it runs. The first one, ',
            el('strong', {}, 'binary micro-PK'),
            ', is live now: choose HIGH or LOW and hold it in mind while a stream of random bits is generated, and the feed shows whether the running total drifts your way.',
          ]),
        ]),
        el('div', { class: 'card' }, [
          el('h3', {}, 'Foresight — forced-choice precognition'),
          el('p', {}, [
            'You commit a choice ',
            el('em', {}, 'before'),
            ' the target exists — bound to a future public-beacon round that hasn\'t been published yet — then the target is revealed and scored. A two-color version is the next experiment to land (spec §7.5).',
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
        'This is where most psi claims go wrong. With many sessions in the database, extreme-looking individual runs are guaranteed by chance alone — the question is whether the aggregate pattern exceeds what chance predicts.'),
      el('div', { class: 'twocol' }, [
        el('div', { class: 'col-bad card' }, [
          el('h3', {}, ['✕ ', 'Not evidence']),
          el('ul', {}, [
            el('li', {}, [el('strong', {}, 'A single hot session. '), 'Even under the textbook psi effect size, three minutes carries a vanishingly small signal. A high score is a fun moment, nothing more.']),
            el('li', {}, [el('strong', {}, 'The leaderboard. '), 'It exists to make participating fun. It is engagement, not proof — multiple comparisons guarantee outliers.']),
            el('li', {}, [el('strong', {}, 'A result picked after the fact. '), 'Cherry-picking from a sea of runs proves nothing; the test must be fixed in advance.']),
          ]),
        ]),
        el('div', { class: 'col-good card' }, [
          el('h3', {}, ['✓ ', 'Where the science lives']),
          el('ul', {}, [
            el('li', {}, [el('strong', {}, 'The pre-registered aggregate. '), 'A test fixed in advance across many sessions and operators — never a result spotted afterward.']),
            el('li', {}, [el('strong', {}, 'Against a calibrated null. '), 'Not a textbook coin, but the generator’s own measured behaviour from large operator-absent control runs.']),
            el('li', {}, [el('strong', {}, 'The HIGH − LOW difference. '), 'Comparing your two intentions cancels any fixed quirk of the hardware; only the intention differs.']),
          ]),
        ]),
      ]),

      // ================= FOR SKEPTICS ====================================
      el('div', { class: 'rigor', id: 'rigor' }, [
        el('span', { class: 'eyebrow' }, 'For skeptics & scientists'),
        el('h2', { class: 'about-h2 first' }, 'The methodology, in full'),
        el('p', { class: 'section-lede' },
          'Everything below is fixed in the open specification and decision log. Here\'s the part that matters if you\'re looking for weaknesses.'),

        el('h3', { class: 'rigor-h3' }, 'Two pre-registered hypotheses'),
        el('p', { class: 'section-lede' },
          'These are the confirmatory hypotheses for the influence (micro-PK) experiments. Foresight experiments are scored on a pre-registered hit-rate against the same calibrated null; each experiment type registers its analysis before its data exists.'),
        el('div', { class: 'twocol' }, [
          el('div', { class: 'hyp card' }, [
            el('span', { class: 'badge' }, 'H1'),
            el('h4', {}, 'Individual consistency'),
            el('p', {}, 'Not “anomalies occur” (they will, by chance) but that specific individuals deviate above chance consistently across their own sessions. The clean unit is the within-operator HIGH − LOW difference; the key statistic is split-half reliability — does an operator’s effect in their first half of sessions predict their second? Screened candidates must replicate under a frozen, fixed-N confirmatory protocol.'),
          ]),
          el('div', { class: 'hyp card' }, [
            el('span', { class: 'badge' }, 'H2'),
            el('h4', {}, 'Excess corpus deviation'),
            el('p', {}, 'Across the whole corpus, does the distribution of session scores deviate from the empirically calibrated null — mean shift, variance inflation, or excess in the |Z| > 3, 4, 5 tails? Intention runs are compared against operator-absent baseline runs through the identical pipeline, with a leave-one-operator-out check so no heavy user can manufacture the result.'),
          ]),
        ]),

        el('h3', { class: 'rigor-h3' }, 'The guarantees that protect the result'),
        el('dl', { class: 'guarantees' }, GUARANTEES.flatMap((g) => [
          el('dt', {}, g.k),
          el('dd', {}, g.v),
        ])),

        el('h3', { class: 'rigor-h3' }, 'Where the randomness comes from'),
        el('p', { class: 'section-lede' },
          'Only a genuinely physical process can, even in principle, be nudged moment to moment. PsyMeter climbs a ladder of sources, and every session records exactly which one produced it:'),
        el('div', { class: 'ladder' }, LADDER.map((s) =>
          el('div', { class: `rung card ${s.cls}` }, [
            el('code', { class: 'rung-tag' }, s.tag),
            el('div', {}, [
              el('div', { class: 'rung-name' }, s.name),
              el('p', {}, s.body),
            ]),
          ]))),

        el('h3', { class: 'rigor-h3' }, 'Verify a result yourself'),
        el('p', { class: 'section-lede' }, [
          'Two independent paths, neither of which trusts the live server. In the browser, open any session’s ',
          el('a', { href: '/verify', 'data-link': true }, 'verification view'),
          ' — it recomputes the pre-commitment and anchor and checks the operator’s Ed25519 signature entirely client-side. Or do it offline against the raw ledger:',
        ]),
        el('pre', { class: 'codeblock' }, [
          el('code', {}, 'python analysis/analyze.py ledger/<file>.jsonl'),
        ]),
        el('p', { class: 'section-lede' },
          'It re-walks the hash chain, re-derives every anchor, re-verifies the signatures and the drand beacon, recomputes the Merkle root over the raw blobs, and reproduces the intention-aware scores — from stdlib alone, byte-for-byte identical to the protocol. The canonical hashing is kept parity-identical between the TypeScript core and the Python script on purpose.'),
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

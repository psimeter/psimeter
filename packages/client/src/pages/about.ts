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
      ', a public randomness beacon that publishes a new, unpredictable number every few seconds (and we verify its BLS signature in-process). Because it did not exist until moments before your run, your session provably could not have been pre-computed and cherry-picked from a library of flattering results.',
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
  { ico: '🎯', title: 'What you do', body: 'Choose HIGH, LOW, or just observe. Focus on the glowing anchor for ~3 minutes while a true random stream ticks past, and watch whether it drifts your way.' },
  { ico: '🔬', title: 'What we’re asking', body: 'Can intention alone nudge a genuinely random physical process — or let you anticipate it? It’s an old, controversial question. We test it at scale, in the open.' },
  { ico: '🔒', title: 'Why you can trust it', body: 'You don’t have to. Every result is locked in advance and verifiable from public data by anyone — the people running the experiment are treated as untrusted.' },
  { ico: '⚖️', title: 'What a result means', body: 'A single hot run is fun, not proof — luck alone produces those. The science is the pre-registered aggregate over thousands of sessions, against a calibrated baseline.' },
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
          'PsyMeter tests a simple, old, and controversial question: can a person, by intention alone, nudge the output of a truly random process — or anticipate one before it happens? Claims like these live or die on their methodology. So the whole platform is built around one rule:'),
        el('p', { class: 'rule' },
          'The experimenter is treated as an untrusted party, and every result is verifiable from public artifacts by a skeptic who trusts no one.'),
        el('div', { class: 'audience-hint' }, [
          el('span', {}, ['Reading as someone ', el('strong', {}, 'curious'), '? Start with the cards just below.']),
          el('span', {}, ['Here to ', el('strong', {}, 'poke holes'), '? Skip to ', el('a', { href: '#rigor' }, 'the methodology'), '.']),
        ]),
      ]),

      // ---- TL;DR ---------------------------------------------------------
      el('h2', { class: 'about-h2' }, 'In 30 seconds'),
      el('div', { class: 'tldr-grid' }, TLDR.map((t) =>
        el('div', { class: 'tldr card' }, [
          el('div', { class: 'tldr-ico' }, t.ico),
          el('h3', {}, t.title),
          el('p', {}, t.body),
        ]))),

      // ---- chain of evidence --------------------------------------------
      el('h2', { class: 'about-h2' }, 'The chain of evidence'),
      el('p', { class: 'section-lede' },
        'Every session walks the same path. Each step closes off a way the experimenter could cheat — or fool themselves:'),
      el('div', { class: 'chain-grid' }, CHAIN.map((s) =>
        el('div', { class: 'chain-card card' }, [
          el('div', { class: 'n' }, s.n),
          el('h3', {}, s.title),
          el('p', {}, s.body),
        ]))),

      el('div', { class: 'callout big-callout' }, [
        el('div', { class: 'callout-mark' }, '◎'),
        el('div', {}, [
          el('strong', {}, 'The anchor is the heart of it. '),
          'It is the short fingerprint of everything you committed to before the randomness existed. Screenshot it: it is your independent proof of exactly what you predicted, and when. During a run it doubles as your concentration target — the thing you hold in mind.',
        ]),
      ]),

      // ---- what a result means ------------------------------------------
      el('h2', { class: 'about-h2' }, 'What a result means — and what it doesn’t'),
      el('p', { class: 'section-lede' },
        'This is where most psi claims go wrong, so we are blunt about it. With millions of sessions, extreme-looking individual runs are guaranteed by chance, even if no effect exists at all.'),
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
          'The platform exists to be attacked. Everything below is fixed in the open specification and decision log; here is the part that matters for poking holes.'),

        el('h3', { class: 'rigor-h3' }, 'Two pre-registered hypotheses'),
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
        el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run a session →'),
      ]),
    ]),
  );
}

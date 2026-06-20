// FAQ (spec §10, section 1) — specific questions about the system, the
// methodology, the psi score, and the actual psi research (with references). The
// plain-English tour is /about; the actionable protocol is /guide. Kept honest
// and skeptic-first, in keeping with the project's "prove OR disprove" stance.

import { el } from '../ui';
import type { Child } from '../ui';

interface QA { q: string; a: Child[]; }
interface Group { title: string; intro?: string; items: QA[]; }

const GROUPS: Group[] = [
  {
    title: 'The basics',
    items: [
      {
        q: 'What is PsyMeter?',
        a: ['A public platform for large-scale experiments testing for so-called ',
          el('em', {}, '“psi”'),
          ': whether a person can, by intention alone, bias a genuinely random physical process, or anticipate a random outcome before it exists. It has two halves — a rigorous scientific instrument, and a gamified website anyone in the world can use.'],
      },
      {
        q: 'Is this real science, or entertainment?',
        a: ['Both, on purpose. The science is a pre-registered analysis run over public data. The game — scores, the leaderboard — exists to attract participants, because sample size is what gives the science any power. The gamification never changes the protocol or what a result means.'],
      },
      {
        q: 'Do I have to believe in psi to take part?',
        a: ['No — skeptics are especially welcome. Every result is independently verifiable, and a flat, boring, null dataset is a perfectly good (and frankly likely) outcome. The project is outcome-neutral: the goal is to prove ', el('strong', {}, 'or'), ' disprove, at scale.'],
      },
      {
        q: 'Is it free and anonymous?',
        a: ['Yes to both. No account, no payment, no personal data. Your identity is a random cryptographic key your browser creates and keeps locally (see ', el('a', { href: '#privacy' }, 'Privacy & identity'), ').'],
      },
      {
        q: 'Will I actually feel anything?',
        a: ['In presentiment, yes — each trial reveals a real calming or unpleasant image, so the emotion is genuine. In micro-PK you simply hold an intention and watch a live feed. Most people feel nothing unusual, and that is a completely normal result.'],
      },
    ],
  },
  {
    title: 'Keeping it honest — the methodology',
    intro: 'The part that matters if you are looking for weaknesses. All of it is fixed in the open specification and decision log.',
    items: [
      {
        q: 'Why should I trust results from someone who wants psi to be real?',
        a: ['You shouldn\'t have to — that is the whole design. The experimenter (us, the owner, the host) is treated as an ', el('strong', {}, 'untrusted party'),
          '. Every session is committed before the data exists, signed, hash-chained, externally timestamped, and recomputable by anyone. The same machinery that would catch a fraudulent experimenter also protects the owner from fooling himself.'],
      },
      {
        q: 'What stops you faking or cherry-picking my results?',
        a: ['Before any randomness exists, your choice, the exact parameters, your signature, and a fresh public-beacon value are frozen into one hash and sealed into an append-only ledger whose head is timestamped to Bitcoin (via OpenTimestamps). You can\'t precompute favourable runs, quietly drop bad ones, or backdate anything — it would break the hash chain or contradict the beacon\'s publication time.'],
      },
      {
        q: 'What is pre-registration, and why does it matter?',
        a: ['The confirmatory hypothesis, the sample size, and the exact analysis script are fixed and published ', el('em', {}, 'before'),
          ' the data is collected. That removes the two ways well-meaning researchers accidentally manufacture significance — stopping early on a good streak (“optional stopping”) and trying many analyses until one works (“the garden of forking paths”). Anything not pre-registered is labelled exploratory and never counted as confirmation.'],
      },
      {
        q: 'What is the “calibrated null” you compare against?',
        a: ['A real physical generator is never a perfect 50/50 coin — it has its own tiny static biases. So results aren\'t scored against a textbook coin; they\'re scored against the generator\'s ', el('strong', {}, 'own measured behaviour'),
          ' from large operator-absent control runs through the identical pipeline.'],
      },
      {
        q: 'What are the two hypotheses, H1 and H2?',
        a: [
          el('strong', {}, 'H1 — individual consistency: '),
          'specific people beat chance consistently across their own sessions. The clean unit is the within-person HIGH−LOW difference (so any fixed quirk cancels), with split-half reliability — does the first half of someone\'s sessions predict the second? ',
          el('strong', {}, 'H2 — excess corpus deviation: '),
          'across everyone, the spread of scores exceeds the calibrated null, with a leave-one-operator-out check so no single heavy (or fraudulent) user can drive the result. The public ',
          el('a', { href: '#psi-score' }, 'psi score'),
          ' is H1 made visible.',
        ],
      },
      {
        q: 'Where does the randomness come from?',
        a: ['Only a genuinely physical process could, even in principle, be nudged moment to moment. PsyMeter climbs a ladder of sources, recording exactly which one produced every session: the OS generator (plumbing and tests only — flagged non-confirmatory), your CPU\'s thermal-noise RDSEED instruction (real physical randomness, good for piloting), and open-hardware or quantum RNGs (the auditable, citable targets for confirmatory data collection).'],
      },
      {
        q: 'How do I verify a result myself?',
        a: ['Two independent ways, neither of which trusts the live server. In the browser, open any session\'s ',
          el('a', { href: '/verify', 'data-link': true }, 'verification view'),
          ' — it recomputes the pre-commitment and anchor and checks the Ed25519 signature entirely client-side. Or, offline against the raw ledger:',
          el('pre', { class: 'codeblock' }, el('code', {}, 'python analysis/analyze.py ledger/<file>.jsonl')),
          'It re-walks the hash chain, re-verifies the signatures and the drand beacon, recomputes the Merkle roots over the raw data, and reproduces every score — from the Python standard library alone, byte-for-byte identical to the protocol.'],
      },
    ],
  },
  {
    title: 'The psi score',
    intro: 'The single number on your history page and the leaderboard.',
    items: [
      {
        q: 'What is the psi score?',
        a: ['One number per person that measures how consistently you beat chance ', el('em', {}, 'in the direction you declared'),
          ', across your own sessions. It is the public, gamified face of H1 — and everyone starts at exactly 0.'],
      },
      {
        q: 'How is it calculated, in plain terms?',
        a: ['Picture a betting game against the claim “it\'s all just chance.” Each session, the score bets that your declared-direction success rate is a little above chance. Win repeatedly and the bet compounds — your evidence grows; do no better than chance and it shrinks. The points are the size of that evidence: every 10× more evidence is +10 points. (Formally it\'s an ',
          el('strong', {}, 'anytime-valid test martingale'),
          ', an “e-value” — chosen precisely so you can watch it live and stop whenever you like without breaking the statistics.)'],
      },
      {
        q: 'Why does it start at 0, and why can it go down?',
        a: ['Because it\'s honest. Under pure chance the evidence hovers around “nothing here” and drifts down about as often as up, forever. It only trends upward if something real is moving outcomes your way. A score that could only ever rise would be a lie — and easy to farm.'],
      },
      {
        q: 'What counts as a good score?',
        a: ['Roughly: 10 points ≈ 10-to-1 odds against chance, 20 ≈ 100-to-1, 30 ≈ 1000-to-1. Reaching 30 points — with at least 5 scored sessions, so it can\'t be one lucky run — flags you as a ', el('strong', {}, 'Candidate'), '.'],
      },
      {
        q: 'I\'m a “Candidate” — am I proven psychic?',
        a: ['No. It means your consistency is unusual enough to be worth a serious, separate test. Across thousands of players, some candidates are expected by chance alone (the leaderboard shows roughly how many), which is exactly why a candidate must ', el('strong', {}, 'replicate'),
          ' under a fresh, frozen, pre-registered protocol. The flag is a starting line, not a finish line — see ', el('a', { href: '/guide', 'data-link': true }, 'the guide'), '.'],
      },
      {
        q: 'Can the score be faked or farmed?',
        a: ['You can\'t bias an individual run — the generator is structurally isolated from your browser — so sheer volume doesn\'t help; extra sessions are just as likely to pull your score down. You could spin up many anonymous keys and hope one gets lucky, but that\'s simply the multiple-comparisons problem, and it\'s defeated at the next stage: a genuine ability has to survive a brand-new pre-registered replication.'],
      },
      {
        q: 'Does the psi score work for every experiment, or only micro-PK?',
        a: ['Both — it\'s the same machinery for every experiment. Each kind contributes a single “did you beat your declared direction this session?” signal: for micro-PK that\'s pushing the bits HIGH or LOW; for presentiment it\'s calling the image\'s valence right more often than chance. Those are combined into one score per person. Presentiment is actually the ', el('em', {}, 'cleaner'),
          ' of the two, because its chance rate is an exact, beacon-derived coin flip with no hardware bias to calibrate away.'],
      },
    ],
  },
  {
    title: 'Psi and the research',
    items: [
      {
        q: 'What does mainstream science say about psi?',
        a: ['It sits firmly outside the scientific consensus. No psi effect has been established to the standard other phenomena meet; reported effects are tiny and contested, and are usually attributed to publication bias, flexible analysis, or methodological flaws. PsyMeter\'s entire design is a direct response to those criticisms — which is the only way data collected here could move anyone.'],
      },
      {
        q: 'Has anyone reported effects before?',
        a: ['There is a long, thoroughly debated research record. A few landmarks, with the skeptical reading attached:',
          el('ul', { class: 'refs' }, [
            el('li', {}, [el('strong', {}, 'PEAR (Princeton, 1979–2007). '), 'Random-event-generator micro-PK; reported effects around 1 part in 10,000, but dominated by a handful of operators — a cautionary tale this project explicitly guards against (leave-one-out, per-operator caps).']),
            el('li', {}, [el('strong', {}, 'Bösch, Steinkamp & Boller (2006), Psychological Bulletin. '), 'A meta-analysis of RNG studies finding a very small but significant effect — which the authors concluded was best explained by publication bias rather than psi.']),
            el('li', {}, [el('strong', {}, 'Bem (2011), “Feeling the Future,” JPSP. '), 'Nine precognition experiments reporting positive results; it became a flashpoint of psychology\'s replication crisis, and large independent replications (e.g. Galak et al., 2012) failed to reproduce it.']),
            el('li', {}, [el('strong', {}, 'Global Consciousness Project. '), 'A worldwide network of RNGs reporting correlations with major events — intriguing to some, unconvincing to most statisticians.']),
            el('li', {}, [el('strong', {}, 'Rhine (Duke, 1930s) and later presentiment work (Radin and others). '), 'The origins of lab parapsychology — forced-choice card tests, and physiological responses recorded before a stimulus appears.']),
          ]),
          'The honest summary: suggestive claims, persistent controversy, and nothing that has convinced the broader field. PsyMeter exists to collect data clean enough that the answer — yes or no — is hard to wave away.'],
      },
    ],
  },
  {
    title: 'Privacy & identity',
    items: [
      {
        q: 'What data do you store about me?',
        a: ['Only the experiment records — your committed choices, the random data, the scores — tied to your anonymous key, and all public by design. No name, email, profile, or account.'],
      },
      {
        q: 'What exactly is my “key”?',
        a: ['A random Ed25519 keypair your browser generates and stores locally. It is your pseudonym and it signs each session as yours. The private half never leaves your device; only the public half appears in the ledger. Clear your browser storage and the pseudonym is gone for good.'],
      },
      {
        q: 'What happens if I become a candidate and contact you?',
        a: ['Only if you choose to. The contact form is the single, voluntary break in anonymity: you sign it with your key (to prove the score is yours) and share a way to reach you, which is stored ', el('strong', {}, 'privately'),
          ' — never on the public ledger, never shown to anyone but the researcher. You can ignore it completely and stay anonymous.'],
      },
    ],
  },
];

const GROUP_IDS = ['basics', 'methodology', 'psi-score', 'research', 'privacy'];

export function renderFaq(outlet: HTMLElement): void {
  outlet.append(
    el('div', { class: 'page about faq' }, [
      el('header', { class: 'about-hero' }, [
        el('span', { class: 'eyebrow' }, 'FAQ'),
        el('h1', {}, 'Questions, answered straight'),
        el('p', { class: 'lede' }, [
          'Specifics about the system, the methodology, the psi score, and what the research actually shows. New here? The plain-English tour is ',
          el('a', { href: '/about', 'data-link': true }, 'About'),
          '; if you want to seriously test your own ability, read ',
          el('a', { href: '/guide', 'data-link': true }, 'the guide'),
          '.',
        ]),
        el('nav', { class: 'faq-toc' }, GROUPS.map((g, i) =>
          el('a', { href: `#${GROUP_IDS[i]}` }, g.title))),
      ]),
      ...GROUPS.flatMap((g, i) => [
        el('section', { class: 'faq-group', id: GROUP_IDS[i] }, [
          el('h2', { class: 'about-h2' }, g.title),
          ...(g.intro ? [el('p', { class: 'section-lede' }, g.intro)] : []),
          ...g.items.map((item) =>
            el('details', { class: 'faq-item' }, [
              el('summary', {}, item.q),
              el('div', { class: 'faq-a' }, item.a),
            ])),
        ]),
      ]),
      el('div', { class: 'callout closing' }, [
        'Still curious, or found a hole? PsyMeter is open source — read the spec, the code, and the analysis script, and check any result yourself. ',
        el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run an experiment →'),
      ]),
    ]),
  );
}

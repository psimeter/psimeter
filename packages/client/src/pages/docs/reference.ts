// Reference chapters: the decision log (D1–D16, §6) and the consolidated list of
// external sources (§References).

import { el } from '../../ui';
import type { Child } from '../../ui';
import { P, REF } from './paths';
import { lead, b, em, code, link, ext, callout } from './prose';

interface Decision { id: string; status: string; title: string; body: Child[]; }

const DECISIONS: Decision[] = [
  { id: 'D1', status: 'DECIDED', title: 'Entropy source(s)', body: [
    'The flagship micro-PK experiment uses a live physical (true) entropy source — only a physical process can, even in principle, be influenced moment-to-moment. A seeded PRNG is excluded from the confirmatory micro-PK arm. A four-rung ',
    link(P.entropy, 'entropy ladder'), ' (os → rdseed → open-hardware TRNG → QRNG) is implemented behind one interface, and every session records exactly which produced it.',
  ] },
  { id: 'D2', status: 'DECIDED', title: 'Provenance & anti-fraud spine', body: [
    'Make the experimenter un-trustable-away: commit–reveal, a streaming Merkle commitment to the raw output, a BLS-verified ',
    ext(REF.drand, 'drand'), ' beacon, a hash-chained append-only log, and external anchoring. The whole flow is ', link(P.provenance, 'the provenance spine'), '.',
  ] },
  { id: 'D3', status: 'DECIDED', title: 'Pre-registration & run protocol', body: [
    'Fixed sample size per session, no optional stopping; tripolar HIGH/LOW/BASELINE micro-PK; one pre-registered primary hypothesis + test statistic per experiment. Serves both ', link(P.hypotheses, 'H1 and H2'), '.',
  ] },
  { id: 'D4', status: 'DECIDED', title: 'Leaderboard framing', body: [
    'With millions of sessions, multi-sigma runs are guaranteed by chance, so the leaderboard is an engagement/transparency feature, never evidence; the headline science is the pre-registered aggregate. ',
    link(P.results, 'Why a single result is not evidence'), '.',
  ] },
  { id: 'D5', status: 'DECIDED', title: 'Baseline / calibration', body: [
    'Characterize the generator with large operator-absent runs through the identical pipeline and use the ', em('empirical'),
    ' mean/variance/autocorrelation; run continuous randomness test suites. The ', link(P.results, 'calibrated null'), '.',
  ] },
  { id: 'D6', status: 'DECIDED (core)', title: 'Operator identity model', body: [
    'A persistent, pseudonymous browser-held ', link(P.crypto, 'Ed25519 key'),
    ' — no PII — that lets an operator accumulate sessions, return, and sign each pre-commitment. Open sub-details: Sybil handling, optional stronger identity for confirmatory candidates, per-operator caps.',
  ] },
  { id: 'D7', status: 'OPEN', title: 'Ethics, governance, licensing', body: [
    'Anonymous online human-subjects data still typically needs an ethics/IRB review for journal acceptance, plus an informed-consent screen and a data-release license. Flagged to decide before launch.',
  ] },
  { id: 'D8', status: 'DECIDED', title: 'Technology stack', body: [
    'TypeScript/Node server + client, a Rust entropy sidecar, and a Python analysis pipeline; SHA-256, Ed25519, domain-separated Merkle, RFC 8785 JCS. See ', link(P.architecture, 'architecture'), '.',
  ] },
  { id: 'D9', status: 'OPEN', title: 'Abuse / automation handling', body: [
    'Unlimited anonymous access invites bots, but because generation is isolated a bot ', b('cannot bias an individual run'),
    ' — only inflate volume. Plan: rate limiting + separating attended from firehose sessions in analysis.',
  ] },
  { id: 'D10', status: 'DECIDED — RAW', title: 'Raw vs conditioned bits', body: [
    'Capture raw, unconditioned samples (conditioning could wash out the signal), calibrate static bias relentlessly, and rely on the HIGH−LOW differential to cancel it. ', link(P.entropy, 'Details'), '.',
  ] },
  { id: 'D11', status: 'OPEN (recommend)', title: 'Confirmatory hardware device', body: [
    'No budget day one: pilot on RDSEED ($0) → add an open-hardware USB TRNG (≈ $35–50) for citable early data → a QRNG later for the flagship dataset. Source-agnostic design now.',
  ] },
  { id: 'D12', status: 'OPEN (recommend adopt)', title: 'Experimenter-as-subject safeguards', body: [
    'The owner is also a subject (the “PEAR Operator 10” risk). Safeguards: an ordinary pseudonymous key; the owner’s data analyzed/reported separately and always subject to leave-one-out and per-operator caps; ideally an independent co-signer of the analysis script and anchors. The ',
    link(P.psiScore, 'psi score'), ' is recomputable by anyone, so the owner topping his own board is checkable.',
  ] },
  { id: 'D13', status: 'DECIDED', title: 'Experiment parameters & configurability', body: [
    'Parameters are configurable but versioned & immutable once published: each experiment is an ', code('ExperimentDefinition'),
    ' (id + integer version + integer/string params) whose content hash binds into every pre-commitment, so configurability never becomes a hidden degree of freedom. The ',
    link(P.experiments, 'micro-PK defaults'), ' are PEAR-anchored.',
  ] },
  { id: 'D14', status: 'DECIDED', title: 'Multiple experiment kinds & the presentiment target', body: [
    'Many kinds behind one shared spine via a thin registry; committed-field compatibility keeps the JSON key ', code('intention'),
    ' so old sessions still verify. The ', link(P.experiments, 'presentiment'),
    ' target is a future drand round only (maximal auditability), with a real, content-hash-pinned CC0 image corpus.',
  ] },
  { id: 'D15', status: 'DECIDED', title: 'Public per-operator evidence: the psi score', body: [
    'The leaderboard’s unit is the person, not the session: an anytime-valid test martingale (e-value) measuring consistent, declared-direction deviation, with decibans, odds, a sigma-equivalent, and a candidate-not-proof threshold. Full construction in ',
    link(P.psiScore, 'the psi score'), '.',
  ] },
  { id: 'D16', status: 'DECIDED', title: 'Live witnesses', body: [
    'Independent real-time co-signers close the parallel-runs (micro-PK) and choice-timing (precognition) residuals: M-of-N capable, deployed at N=1, with drand + RFC 3161 TSA + OTS trusted time. ',
    link(P.witnesses, 'Live witnesses'), '.',
  ] },
];

export function renderDecisions(): Child[] {
  return [
    lead(
      'Every design choice that affects scientific validity is recorded as a numbered decision, with its rationale, in the living specification. This is the index — each links to the chapter where it is explained in full. Status is shown as of the current spec.',
    ),
    el('div', { class: 'stack-lg' }, DECISIONS.map((d) =>
      el('div', { class: 'card', id: d.id.toLowerCase() }, [
        el('div', { class: 'row-between' }, [
          el('h3', { style: 'margin:0' }, `${d.id} · ${d.title}`),
          el('span', { class: `badge ${d.status.startsWith('OPEN') ? 'warn' : 'good'}` }, d.status),
        ]),
        el('p', { style: 'margin:10px 0 0; color:#cdd6e2' }, d.body),
      ]),
    )),
    callout(
      'These mirror §6 of ', code('docs/SPECIFICATION.md'),
      '. “OPEN” items still need the owner’s input before they affect build work; “DECIDED” items are locked and reflected in the code.',
    ),
  ];
}

interface Ref { cite: Child[]; href: string; note: string; }
interface RefGroup { title: string; items: Ref[]; }

const REF_GROUPS: RefGroup[] = [
  { title: 'Psi research & critique', items: [
    { cite: [b('PEAR'), ' — Princeton Engineering Anomalies Research (now ICRL).'], href: REF.pear, note: 'Random-event-generator micro-PK, 1979–2007; reported effects ≈ 1 part in 10,000, dominated by a few operators — the cautionary tale this project guards against.' },
    { cite: [b('Bösch, Steinkamp & Boller (2006)'), ', Psychological Bulletin 132(4):497–523.'], href: REF.bosch2006, note: 'Meta-analysis of RNG studies finding a very small but significant effect, which the authors concluded was best explained by publication bias rather than psi.' },
    { cite: [b('Bem (2011)'), ', “Feeling the Future,” JPSP.'], href: REF.bem2011, note: 'Nine precognition experiments reporting positive results; a flashpoint of psychology’s replication crisis.' },
    { cite: [b('Galak, LeBoeuf, Nelson & Simmons (2012)'), ', JPSP.'], href: REF.galak2012, note: 'Seven experiments (N = 3,289) that failed to replicate Bem (2011); average effect size d = 0.04, indistinguishable from zero.' },
    { cite: [b('Mossbridge, Tressoldi & Utts (2012)'), ', Frontiers in Psychology.'], href: REF.mossbridge2012, note: 'Meta-analysis of predictive physiological anticipation (presentiment) — the paradigm behind PsyMeter’s precognition experiment.' },
    { cite: [b('Global Consciousness Project'), '.'], href: REF.gcp, note: 'A worldwide network of RNGs reporting correlations with major events — intriguing to some, unconvincing to most statisticians.' },
    { cite: [b('Rhine Research Center'), '.'], href: REF.rhine, note: 'Heir to J.B. Rhine’s Duke lab — the origins of forced-choice ESP testing.' },
  ] },
  { title: 'Cryptographic standards & primitives', items: [
    { cite: [b('FIPS 180-4'), ' — Secure Hash Standard (SHA-2).'], href: REF.fips180, note: 'The SHA-256 used for commitments, Merkle nodes, and the ledger chain.' },
    { cite: [b('RFC 8032'), ' — EdDSA / Ed25519.'], href: REF.rfc8032, note: 'The operator signature scheme; keys are generated and held in the browser.' },
    { cite: [b('RFC 8785'), ' — JSON Canonicalization Scheme (JCS).'], href: REF.rfc8785, note: 'Deterministic JSON serialization so hashes reproduce byte-for-byte across TS and Python.' },
    { cite: [b('RFC 3161'), ' — Time-Stamp Protocol (TSA).'], href: REF.rfc3161, note: 'Independent timestamping of ledger/witness feed heads.' },
    { cite: ['Merkle tree.'], href: REF.merkle, note: 'The streaming output commitment that pins the raw bit stream live.' },
  ] },
  { title: 'Public randomness & anchoring', items: [
    { cite: [b('drand'), ' / League of Entropy.'], href: REF.drand, note: 'The public randomness beacon (quicknet chain); each pulse is BLS-verified in-process before binding.' },
    { cite: [b('NIST Interoperable Randomness Beacons'), '.'], href: REF.nistBeacon, note: 'An alternative public-beacon source of the same freshness guarantee.' },
    { cite: [b('OpenTimestamps'), '.'], href: REF.opentimestamps, note: 'Bitcoin-anchored timestamping (the .ots proofs) — no account, no cost.' },
  ] },
  { title: 'Randomness testing & hardware entropy', items: [
    { cite: [b('NIST SP 800-22'), ' — Statistical Test Suite.'], href: REF.sp80022, note: 'Battery of randomness tests run on the calibration baseline.' },
    { cite: [b('Dieharder'), '.'], href: REF.dieharder, note: 'Classic randomness test battery.' },
    { cite: [b('TestU01'), ' (incl. BigCrush).'], href: REF.testu01, note: 'Stringent randomness test suite.' },
    { cite: [b('Intel DRNG'), ' software implementation guide.'], href: REF.drng, note: 'The RDSEED on-die thermal-noise source used for pilot-grade physical entropy.' },
    { cite: [b('Infinite Noise TRNG'), ' (open hardware).'], href: REF.infnoise, note: 'Open-hardware, open-firmware USB entropy source — the budget bridge to citable data.' },
    { cite: [b('OneRNG'), ' (open hardware).'], href: REF.onerng, note: 'OSHWA-certified, inspectable USB hardware RNG.' },
  ] },
  { title: 'Statistics — anytime-valid inference', items: [
    { cite: [b('Ramdas, Grünwald, Vovk & Shafer (2023)'), ', “Game-Theoretic Statistics and Safe Anytime-Valid Inference,” Statistical Science 38(4).'], href: REF.savi, note: 'The foundation for the psi score: test martingales, e-values, and continuous monitoring without inflating false positives.' },
    { cite: [b('Ville’s inequality'), '.'], href: REF.ville, note: 'The bound that makes a live, stop-whenever-you-like evidence score legitimate.' },
    { cite: [b('The ban / deciban'), ' (I.J. Good’s weight of evidence).'], href: REF.deciban, note: 'The unit the psi-score points are expressed in: +10 points per 10× of evidence.' },
  ] },
];

export function renderReferences(): Child[] {
  return [
    lead(
      'Every external claim in this wiki traces to a public source. Here they are, grouped, each with a one-line note on why it matters here. Links open in a new tab.',
    ),
    ...REF_GROUPS.flatMap((g) => [
      el('h2', { id: g.title.toLowerCase().replace(/[^a-z]+/g, '-') }, g.title),
      el('ul', { class: 'refs' }, g.items.map((r) =>
        el('li', {}, [...r.cite, ' ', el('span', { class: 'faint' }, r.note), ' ', ext(r.href, '↗')]),
      )),
    ]),
    callout(
      'The canonical, continuously-updated source of truth is the project’s own ',
      code('docs/SPECIFICATION.md'),
      ' and the open code in the repository. This wiki is its public mirror; if you find drift, it’s a bug worth reporting.',
    ),
  ];
}

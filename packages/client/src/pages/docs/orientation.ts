// Orientation chapters: Start here, the core principle, and the glossary.
// Content mirrors spec/RATIONALE.md §1–§3 and the design pillars (§2).

import { el } from '../../ui';
import type { Child } from '../../ui';
import { P, REF } from './paths';
import { h2, p, lead, b, em, ul, link, ext, callout, warn, defs } from './prose';

export function renderStart(): Child[] {
  return [
    lead(
      'PsiMeter is an open-source platform for large-scale, anonymous, web-based experiments that test for putative ',
      em('“psi”'),
      ' effects — whether a person can, by intention alone, bias a genuinely physical random process (micro-psychokinesis), or anticipate a random outcome before it exists (forced-choice precognition).',
    ),
    p(
      'These docs are the technical companion to the project. The ',
      link('/about', 'friendly tour'), ', ', link('/faq', 'FAQ'), ', and ', link('/guide', 'guide'),
      ' are the gentle on-ramp for casual players. This wiki is the deep version: it explains every concept, justifies every algorithm and design decision, and links to the public sources behind each claim — enough to understand exactly why the platform is built the way it is, and to run and check it yourself.',
    ),

    h2('two-faces', 'Two equally important faces'),
    p('PsiMeter is deliberately two things at once, and neither is allowed to compromise the other:'),
    ul([
      [b('A scientific instrument. '), 'Rigorous, fraud-resistant, auditable methodology — fixed-N runs, pre-registration, a calibrated baseline, and a cryptographic provenance spine so results survive adversarial scrutiny from a skeptical scientist or journal reviewer.'],
      [b('A public, gamified website. '), 'Engaging enough that strangers worldwide actually play, because sample size is the data-collection engine. The gamification ', b('never'), ' alters the protocol or misrepresents what a result means.'],
    ]),

    h2('non-negotiable', 'The one non-negotiable'),
    callout(
      b('The experimenter is treated as an untrusted party. '),
      'A skeptic must be able to verify every result from public artifacts alone, without trusting the owner, the server, or the host. This single principle drives the entire cryptographic design — it is explained in full in ',
      link(P.principle, 'Why you don’t have to trust us'), '.',
    ),
    p(
      'The project owner is also a test subject (a self-described RNG-influencer) and wants to prove ', b('or'),
      ' disprove the effect at scale, on no budget. The stance is outcome-neutral: a flat, boring null is a perfectly good — and frankly likely — result. The same machinery that would catch a fraudulent experimenter also protects the owner from self-deception.',
    ),

    h2('how-to-read', 'How to read this wiki'),
    p('The sidebar is ordered roughly from “why” to “how”. If you are here to…'),
    defs([
      ['…decide whether to trust it', [link(P.principle, 'The core principle'), ', ', link(P.provenance, 'the provenance spine'), ', ', link(P.threat, 'the threat model'), ', then ', link(P.verify, 'verify a result yourself'), '.']],
      ['…judge the science', [link(P.hypotheses, 'The two hypotheses'), ', ', link(P.results, 'what a result means'), ', and ', link(P.psiScore, 'the psi score'), '.']],
      ['…understand the cryptography', [link(P.crypto, 'Cryptographic building blocks'), ', ', link(P.witnesses, 'live witnesses'), ', and ', link(P.entropy, 'randomness & entropy'), '.']],
      ['…run or extend it', [link(P.run, 'Run it yourself'), ', ', link(P.architecture, 'architecture & repo layout'), ', and the ', link(P.decisions, 'decision log'), '.']],
    ]),
    p(
      'New to the terminology? Keep the ', link(P.glossary, 'glossary'),
      ' open in another tab. Every external claim is sourced in ', link(P.references, 'References & further reading'), '.',
    ),

    callout(
      'The honest bottom line, stated up front: a single session has essentially ', b('no'),
      ' statistical power (see ', link(P.results, 'what a result means'),
      '). The science lives entirely in aggregation across many sessions and many people. The point of this platform is not to be believed — it is to be ', b('checked'), '.',
    ),
  ];
}

export function renderPrinciple(): Child[] {
  return [
    lead(
      'Claims of mind-over-randomness have a long history of not surviving scrutiny — usually because the result rested on trusting the people who collected it. PsiMeter’s answer is to remove trust from the equation entirely.',
    ),

    h2('untrusted', 'The experimenter is untrusted'),
    p(
      'A credible result cannot require anyone to trust the server operator. So the design assumes the operator — us, the owner, the host — might be incompetent, biased, or actively fraudulent, and asks: ',
      em('can an independent auditor, months later, with only the public log, still reconstruct the truth?'),
      ' Everything in ', link(P.provenance, 'the provenance spine'), ' exists to make the answer “yes.”',
    ),
    p('Concretely, an auditor with only the public artifacts must be able to confirm that:'),
    ul([
      ['each session’s intention or prediction was fixed ', b('before'), ' any randomness existed;'],
      ['the random data was not altered, cherry-picked, or quietly dropped;'],
      ['the session happened ', b('after'), ' a known public moment (it can’t have been pre-computed);'],
      ['nothing was inserted, removed, reordered, or backdated in the corpus;'],
      ['every published statistic is reproducible from the raw data.'],
    ]),

    h2('pillars', 'The seven design pillars'),
    p('These are the load-bearing principles. Every feature is judged against them.'),
    defs([
      ['1 · Untrusted experimenter', ['An independent auditor must verify results from published artifacts alone. This drives most of the cryptography.']],
      ['2 · Pre-commitment over post-hoc', ['Every prediction — intended direction, target choice, sample size — is cryptographically committed before the random data exists. No optional stopping, no after-the-fact selection of which sessions “count.”']],
      ['3 · Full provenance & tamper-evidence', ['Every session is recorded in an append-only, hash-chained log whose head is periodically anchored to an external timestamp. The dataset cannot be silently edited, reordered, or pruned.']],
      ['4 · Reproducible analysis', ['Raw data + deterministic, versioned analysis code → anyone re-runs it and gets identical numbers. Collection code and analysis code are kept separate.']],
      ['5 · One-way isolation of the generator', ['During a micro-PK run, the generator reads ', b('nothing'), ' from the client. Isolation is enforced architecturally, not by policy.']],
      ['6 · Honest aggregate inference', ['The scientific claim lives in a single, pre-registered, corpus-level test — never a cherry-picked session. Engagement features must not be confusable with evidence.']],
      ['7 · Open by default', ['Code, protocol, pre-registration, and (eventually) the raw dataset are all public.']],
    ]),

    h2('why-crypto', 'Why so much machinery?'),
    p(
      'Each safeguard answers a specific way a result could be faked or fooled — the exact failure modes the critical literature blames for past psi claims (baseline bias, optional stopping, selective reporting, multiple comparisons; see ',
      ext(REF.bosch2006, 'Bösch, Steinkamp & Boller, 2006'),
      '). The cryptography is not decoration; it is what converts “trust us” into “check for yourself.” The chapters that follow walk through every piece:',
    ),
    ul([
      [link(P.crypto, 'Commitments, anchors, Merkle trees, hash chains, signatures, beacons'), ' — the building blocks.'],
      [link(P.entropy, 'Randomness & entropy'), ' — why only a true physical source could carry the effect, and how its quality is checked.'],
      [link(P.witnesses, 'Live witnesses'), ' — independent real-time co-signers that close the last server-side attacks.'],
      [link(P.threat, 'Threat model & residual trust'), ' — what is closed, and what honestly is not (yet).'],
    ]),
    warn(
      'A fair question: “doesn’t all this just move the trust to the cryptography?” No — the primitives (SHA-256, Ed25519, Merkle, drand’s BLS) are public standards an auditor re-checks independently. You don’t trust ',
      em('our'),
      ' implementation; you re-run the math. See ', link(P.architecture, 'the trust-path principle'), '.',
    ),
  ];
}

export function renderGlossary(): Child[] {
  const term = (id: string, t: string): HTMLElement => el('dfn', { id, class: 'gloss-term' }, t);
  return [
    lead('Working definitions for the terms used throughout the wiki. Where a term has its own chapter, the definition links to it.'),
    defs([
      [term('experiment', 'Experiment'), ['A type/protocol — e.g. binary micro-PK or two-color precognition. See ', link(P.experiments, 'the experiments'), '.']],
      [term('session', 'Session / Run'), ['One execution of an experiment by one operator, of fixed duration/length. A single session is never evidence (', link(P.results, 'why'), ').']],
      [term('operator', 'Operator'), ['The anonymous/pseudonymous person performing a session, identified only by a browser-held ', link(P.crypto, 'Ed25519 key'), '.']],
      [term('intention', 'Intention / Direction'), ['The pre-declared target of a micro-PK run: HIGH, LOW, or BASELINE.']],
      [term('commitment', 'Commitment (pre-commitment)'), ['A hash published ', b('before'), ' generation that binds the prediction + parameters without revealing data. ', link(P.crypto, 'How it works'), '.']],
      [term('anchor', 'Anchor'), ['A short, human-readable value shown to the operator, cryptographically derived from the pre-commitment — the public “fingerprint” of the run, and (in ESP framing) the mental focal point.']],
      [term('reveal', 'Reveal'), ['Post-run publication of the values that let anyone verify the commitment.']],
      [term('beacon', 'Beacon'), ['An external public-randomness source (PsiMeter uses ', ext(REF.drand, 'drand'), ') whose value did not exist before the run started — proof of freshness.']],
      [term('baseline', 'Baseline / Calibration'), ['Operator-absent runs through the identical pipeline, used to characterize the generator’s ', em('true'), ' behaviour. See ', link(P.results, 'the calibrated null'), '.']],
      [term('merkle', 'Merkle root / commitment'), ['A single hash that pins an entire stream of data, computed as a ', ext(REF.merkle, 'Merkle tree'), '. Folded live so raw output can’t be altered after the fact.']],
      [term('ledger', 'Ledger'), ['The append-only, hash-chained log of all sessions; tamper-evident and externally anchored. ', link(P.crypto, 'Details'), '.']],
      [term('witness', 'Witness'), ['An independent process that co-signs run artifacts in real time. ', link(P.witnesses, 'Live witnesses'), '.']],
      [term('z', 'Sigma / Z'), ['Standardized deviation of a run’s outcome from chance expectation. On-screen Z is ', b('display-only'), '; authoritative numbers come from the analysis pipeline.']],
      [term('trial', 'Trial'), ['A single forced-choice event (precognition) or a fixed block of raw bits (micro-PK).']],
      [term('psi-score', 'Psi score'), ['The per-person, anytime-valid ', em('e-value'), ' shown on the leaderboard — consistency made visible. ', link(P.psiScore, 'Full explanation'), '.']],
      [term('preregistration', 'Pre-registration'), ['Fixing and publishing the confirmatory hypothesis, sample size, and analysis script ', b('before'), ' data collection.']],
      [term('h1h2', 'H1 / H2'), ['The two pre-registered hypotheses — individual consistency (H1) and excess corpus deviation (H2). ', link(P.hypotheses, 'See here'), '.']],
    ]),
  ];
}

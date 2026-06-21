// The trust-machinery chapters: the provenance spine (§7), the cryptographic
// building blocks, randomness & entropy (D1/D10), live witnesses (D16), and the
// honest threat model (§7.4).

import type { Child } from '../../ui';
import { el } from '../../ui';
import { P, REF } from './paths';
import { h2, p, lead, b, em, code, pre, ul, ol, link, ext, callout, warn, defs } from './prose';

export function renderProvenance(): Child[] {
  return [
    lead(
      'The provenance spine is what makes the whole thing auditable. It guarantees that an independent auditor, months later, with only the public log, can confirm every result was committed before the data existed, not altered or cherry-picked, fresh, append-only, and reproducible. Here is the sequence, step by step.',
    ),

    h2('phase-a', 'Phase A — pre-commitment (no randomness exists yet)'),
    ol([
      ['You choose an experiment and declare your intention (HIGH / LOW / BASELINE) or, for precognition, prepare to commit each trial’s choice.'],
      ['The server fetches the latest public ', link(P.crypto, 'beacon'), ' pulse B_t — proof the run is “not before T.”'],
      ['The server computes the ', b('pre-commitment'), ':'],
    ]),
    pre('precommit = H( experimentId ‖ version ‖ experimentHash ‖ intention\n               ‖ operatorPubKey ‖ beacon ‖ sessionId ‖ nonce ‖ prevHead )'),
    ol([
      ['It shows you the ', b('anchor'), ' — a short human encoding of the pre-commitment — which you can screenshot as your personal proof.'],
      ['Your browser ', b('signs'), ' the pre-commitment with a key only you hold; the server appends an OPEN record (pre-commit + your signature) to the ledger and publishes the new head.'],
    ]),
    p('This freezes your intention, the exact parameters, and your identity ', em('before a single random bit exists'), ', and timestamps them in the chain. The server cannot retro-edit your intention without breaking your signature; you cannot later deny it.'),

    h2('phase-b', 'Phase B — generation (one-way, reads nothing from you)'),
    p(
      'A separate, isolated generator pulls a fixed number of raw samples at a fixed rate (no optional stopping). Each sample is folded into a rolling ',
      link(P.crypto, 'Merkle commitment'),
      '. Periodic checkpoint roots and a visual frame are streamed to your screen ',
      b('one-way only'),
      ' — nothing you do can reach the generator. At the end the generator hands the server ',
      code('C_out = MerkleRoot(all raw samples)'), '.',
    ),
    p(
      'The streaming Merkle commitment is what replaces “commit the seed” for a non-reproducible physical source: the raw stream is pinned ',
      em('as it is produced'),
      ', so afterward no bit can be swapped, dropped, or quietly left out. The one-way checkpoints also let your client act as a lightweight witness that the stream existed live.',
    ),

    h2('phase-c', 'Phase C — reveal & seal'),
    ol([
      ['The server computes display statistics against the ', link(P.results, 'calibrated baseline'), ' (these are for show — authoritative numbers come from the analysis pipeline).'],
      ['It appends a SEALED record: the pre-commit, C_out, the checkpoints, the stats, and a content-addressed reference to the raw blob.'],
      ['Periodically, the ledger head is ', link(P.crypto, 'anchored externally'), ' (RFC 3161 TSA / public git / OpenTimestamps → Bitcoin), freezing the whole corpus in time.'],
    ]),

    h2('what-each-buys', 'What each move buys you'),
    defs([
      ['Declare → sign → log', ['Freezes intention, parameters, and operator identity before any randomness, and timestamps them in the chain.']],
      ['The anchor', ['A short, screenshot-able fingerprint of exactly what you committed to — strictly stronger than “a number from the seed” because it binds intention + parameters + freshness.']],
      ['Beacon binding', ['Proves the session record did not exist before the beacon’s publication time — no pre-computing a library of runs and keeping only flattering ones.']],
      ['Streaming Merkle', ['Pins the raw stream live, so it cannot be altered or cherry-picked after the fact.']],
      ['Seal + hash chain + external anchor', ['Makes the corpus append-only and frozen: no silent insertion, deletion, reordering, or backdating.']],
    ]),

    h2('auditor', 'How an auditor verifies it (public artifacts only)'),
    ol([
      ['Recompute ', code('precommit'), ' from the revealed fields; verify the operator signature against the public key. → intention & params were fixed and authenticated.'],
      ['Confirm the OPEN record precedes the SEALED record, and that B_t matches the public beacon archive at time T. → intention pre-dated the data; the session is fresh.'],
      ['Recompute ', code('C_out = MerkleRoot(raw blob)'), '; check it equals the sealed value and that streamed checkpoints are consistent prefixes. → data was not altered.'],
      ['Walk the hash chain; confirm the head matches the external timestamps. → nothing inserted/removed/reordered/backdated.'],
      ['Re-run the published deterministic analysis over the raw blobs; reproduce every statistic. → analysis is honest.'],
    ]),
    callout(
      'You can do steps 1–3 right now in your browser via the ',
      link('/verify', 'verification view'),
      ', and all five offline with ', code('analyze.py'),
      '. See ', link(P.verify, 'verify a result yourself'), '.',
    ),
  ];
}

export function renderCrypto(): Child[] {
  return [
    lead(
      'Every link in the spine is a public-standard primitive an auditor re-checks independently — you trust the math, not our code. This chapter defines each one and says exactly how PsyMeter uses it.',
    ),

    h2('canonicalization', 'Canonical JSON (RFC 8785 / JCS)'),
    p(
      'Before anything is hashed, the data is serialized deterministically with a subset of ',
      ext(REF.rfc8785, 'RFC 8785 JSON Canonicalization Scheme'),
      ': sorted keys, compact separators, integers and strings only — ',
      b('no floats'),
      ' (z-scores are display-only and derived later in analysis). This is what lets the TypeScript core and the Python analysis produce ',
      b('byte-identical'),
      ' hashes. Keeping ', code('canonicalize.ts'), ' and the canonical form in ', code('analyze.py'),
      ' in lock-step is treated as sacred.',
    ),

    h2('sha256', 'SHA-256'),
    p(
      'The hash function under everything — commitments, Merkle nodes, the ledger chain. A standard, collision-resistant cryptographic hash (',
      ext(REF.fips180, 'FIPS 180-4'),
      '). The core uses pure-JS ', code('@noble/hashes'),
      ' (byte-identical to ', code('node:crypto'), '), so the same hashing runs in the browser ', link('/verify', '/verify'), ' view and in Node.',
    ),

    h2('commitment', 'Commitment & anchor'),
    p(
      'A ', b('commitment'), ' is a hash published before generation that binds your prediction and the exact parameters without revealing any data. After the run, the inputs are revealed and anyone recomputes the hash to check it. The ',
      b('anchor'),
      ' is a short, human-readable encoding of that commitment (e.g. ', code('TIDE-7F2A-RIVER'),
      ') — the public fingerprint of the run, and, in ESP framing, the operator’s mental focal point. Full flow in ',
      link(P.provenance, 'the provenance spine'), '.',
    ),

    h2('merkle', 'Domain-separated Merkle tree'),
    p(
      'A ', ext(REF.merkle, 'Merkle tree'),
      ' reduces an entire stream to a single root hash, computed by hashing pairs of leaves up to the top. PsyMeter folds the raw output into the root ',
      em('as it streams'),
      ', so the commitment is fixed live. It is ', b('domain-separated'),
      ' — leaves are hashed with a ', code('0x00'), ' prefix and internal nodes with ', code('0x01'),
      ' — which prevents second-preimage attacks that confuse a leaf for a node. The Python Merkle in ',
      code('analyze.py'), ' mirrors this byte-for-byte.',
    ),

    h2('ledger', 'Hash-chained append-only ledger'),
    p('Every session is two immutable entries — a ', code('session.open'), ' then a ', code('session.seal'), ' — each carrying the hash of the previous entry:'),
    pre(
`{ seq, ts, prevHash: "sha256:…",
  type: "session.open" | "session.seal" | "baseline.seal"
        | "external.anchor" | "witness.anchor",
  payload: { … },
  entryHash: "sha256:…" }   # H(JCS(seq, ts, prevHash, type, payload))`,
    ),
    p(
      'Because each entry commits to the one before it, you cannot insert, delete, reorder, or edit any record without breaking every hash downstream — a tamper-evident chain. ',
      em('ts'), ' is informational only; the trusted time is the beacon and the external anchor.',
    ),

    h2('ed25519', 'Ed25519 operator signatures'),
    p(
      'Your identity is a random ', ext(REF.rfc8032, 'Ed25519'),
      ' keypair your browser generates and stores locally — no name, no email. The private half never leaves your device; the public half is your pseudonym in the ledger. You ',
      b('sign'),
      ' each pre-commitment with it (and, for precognition, each per-trial choice), which gives non-repudiation: the server can’t forge your intention, and you can’t deny it. Clear your browser storage and the pseudonym is gone forever.',
    ),

    h2('beacon', 'Public randomness beacon (drand quicknet + BLS)'),
    p(
      'To prove a run is fresh, each session binds a pulse from a public randomness beacon — ',
      ext(REF.drand, 'drand'),
      ', run by the League of Entropy. PsyMeter uses the ', b('quicknet'),
      ' chain (unchained, 3-second pulses). Crucially, the server ',
      b('BLS-verifies'),
      ' each pulse’s signature against the hardcoded group public key ',
      em('before'),
      ' binding it (', ext(REF.drandQuicknet, 'how drand signs'),
      ') — it never trusts the drand endpoint for authenticity, only for delivery. Quicknet’s signed message is simply ',
      code('H(round)'),
      ' with no previous-signature dependency, which makes independent verification simpler. (',
      ext(REF.nistBeacon, 'NIST’s beacon'), ' is an alternative source of the same idea.)',
    ),

    h2('anchoring', 'External anchoring (OpenTimestamps + RFC 3161 TSA)'),
    p('The hash chain proves internal consistency; external anchoring proves the corpus existed at a point in real time and can’t be rebuilt later. PsyMeter uses two complementary anchors:'),
    ul([
      [b('OpenTimestamps → Bitcoin. '), code('npm run anchor'), ' submits the ledger head to ', ext(REF.opentimestamps, 'OpenTimestamps'), ' and writes a standard detached ', code('.ots'), ' proof you can upgrade and verify later — Bitcoin-anchored, no account, no cost.'],
      [b('RFC 3161 Time-Stamp Authority. '), 'An independent ', ext(REF.rfc3161, 'TSA'), ' co-signs feed heads (used heavily by ', link(P.witnesses, 'witnesses'), '), giving an un-forgeable timestamp at TSA granularity even when only the owner runs a node.'],
    ]),
    callout(
      'Note the layering: drand proves “not ', em('before'),
      ' T” at session time; OTS/TSA prove “existed ', em('by'),
      ' T” afterward. Together they sandwich every record in time.',
    ),
  ];
}

export function renderEntropy(): Child[] {
  return [
    lead(
      'Only a genuinely physical, nondeterministic process could, even in principle, be nudged moment-to-moment by intention. A seeded PRNG is deterministic after seeding — there is nothing to influence — so it is excluded from the confirmatory micro-PK arm. PsyMeter climbs a ladder of real sources and records exactly which one produced every session.',
    ),

    h2('ladder', 'The entropy ladder'),
    p('From lowest to highest credibility / auditability:'),
    el('div', { class: 'ladder' }, [
      el('div', { class: 'card rung' }, [
        el('span', { class: 'rung-tag' }, 'os'),
        el('div', {}, [el('div', { class: 'rung-name' }, 'OS entropy — CI / plumbing only'),
          p('A CSPRNG seeded from hardware (', code('getrandom'), ' / ', code('BCryptGenRandom'), '), deterministic after seeding. Flagged ', b('non-confirmatory'), ' and not even valid for personal piloting.')]),
      ]),
      el('div', { class: 'card rung mid' }, [
        el('span', { class: 'rung-tag' }, 'rdseed'),
        el('div', {}, [el('div', { class: 'rung-name' }, 'CPU RDSEED — real physical, pilot-grade'),
          p('The CPU’s on-die thermal-noise entropy source (', ext(REF.drng, 'Intel DRNG'), '; distinct from ', code('RDSEED'), '’s cousin ', code('RDRAND'), ', which is a CSPRNG reseeded by it). Genuinely physical, free, already in the owner’s PC — good for local self-testing, but whitened on-die and vendor-opaque, so not the most auditable choice for publication. Auto-selected when the Rust sidecar is built.')]),
      ]),
      el('div', { class: 'card rung mid' }, [
        el('span', { class: 'rung-tag' }, 'usb-trng'),
        el('div', {}, [el('div', { class: 'rung-name' }, 'Open-hardware USB TRNG — auditable, citable'),
          p('Avalanche/thermal noise over USB from an open-hardware, open-firmware device: ', ext(REF.infnoise, 'Infinite Noise TRNG'), ' (≈ $35) or ', ext(REF.onerng, 'OneRNG'), ' (≈ $50). Within hobbyist budget and auditable because the design is public — the realistic bridge to credible data collection without a grant.')]),
      ]),
      el('div', { class: 'card rung top' }, [
        el('span', { class: 'rung-tag' }, 'qrng'),
        el('div', {}, [el('div', { class: 'rung-name' }, 'Quantum RNG — the confirmatory target'),
          p('Samples an irreducibly indeterministic quantum process: the most defensible source and the eventual confirmatory target. The priciest, hence later.')]),
      ]),
    ]),
    p(
      'One ', code('EntropySource'),
      ' interface has all of these as implementations; every session records the exact source, device, firmware, and sampling parameters. Decisions ',
      link(P.decisions, 'D1 & D11'), ' track the source plan; the Rust sidecar that does the raw reads is described in ',
      link(P.architecture, 'architecture'), '.',
    ),

    h2('raw', 'Raw, unconditioned bits (decision D10)'),
    p(
      'Hardware sources are normally ', em('whitened'),
      ' (von Neumann / hashing) to remove bias — but conditioning could also wash out the tiny intention signal we are hunting. So PsyMeter captures ',
      b('raw, unconditioned'),
      ' samples, documents the exact sampling, calibrates the static bias relentlessly, and relies on the ',
      link(P.hypotheses, 'HIGH−LOW differential'),
      ' to cancel it. The bit-to-trial mapping is frozen at launch and never changed.',
    ),

    h2('test-suites', 'Continuous randomness testing'),
    p(
      'A compromised or biased source shows up first in the ', link(P.results, 'baseline'),
      '. PsyMeter runs standard statistical test suites on operator-absent output:',
    ),
    ul([
      [ext(REF.sp80022, 'NIST SP 800-22'), ' — the Statistical Test Suite (STS) for RNGs.'],
      [ext(REF.dieharder, 'Dieharder'), ' — the classic battery of randomness tests.'],
      [ext(REF.testu01, 'TestU01'), ' — including the stringent BigCrush battery.'],
    ]),
    callout(
      b('Two separate axes. '),
      'Provenance (is the record honest?) is closed by cryptography. ',
      em('Entropy-source integrity'),
      ' (is the hardware genuinely physical and unmanipulated?) is a different question, handled here by calibration, the test suites, and open/auditable hardware — see the ',
      link(P.threat, 'threat model'), '.',
    ),
  ];
}

export function renderWitnesses(): Child[] {
  return [
    lead(
      'Two attacks survive the basic provenance accounting because the experiment server alone produced every artifact. Live witnesses — independent processes that co-sign artifacts in real time — close both. This is decision D16, the most recent addition to the spine.',
    ),

    h2('attacks', 'The two residual attacks'),
    ul([
      [b('Parallel runs (micro-PK). '), 'A malicious server could privately roll several physical streams for one pre-committed session and seal only the flattering one.'],
      [b('Choice-timing / backdating (precognition). '), 'A malicious server could lie about ', em('when'), ' a forced choice arrived, so it no longer provably precedes its target beacon round.'],
    ]),

    h2('model', 'The witness model — M-of-N, deployed at N=1'),
    p(
      'A ', b('witness'),
      ' is an independent process — its own Ed25519 key, host, ideally operator — that co-signs a subject and publishes it to its own append-only, hash-chained feed. Verifiers (',
      code('analyze.py'), ' and ', link('/verify', '/verify'),
      ') count ≥ M of N ', b('trusted'), ' witnesses, where the trusted set is the ',
      em('auditor’s'),
      ' published list (like the hardcoded drand group key), never the server’s say-so. The protocol and verifiers are M-of-N from day one but deployed at ',
      b('N=1 / M=1'),
      ' today — one node, runnable by anyone from the open-source repo via ', code('npm run witness'),
      ' (see ', link(P.run, 'run a witness node'), '). Adding federated peers is configuration, not code.',
    ),

    h2('witnessed', 'What is witnessed'),
    defs([
      ['Micro-PK', ['the session ', b('open'), ', ', b('every live checkpoint root'), ', and the ', b('seal'), ' — and the sealed output commitment must be the Merkle continuation of the witnessed checkpoint prefixes (recomputable from the published raw blob), so a privately-rolled alternate stream cannot be substituted at seal.']],
      ['Precognition', ['each forced-choice commit, ', b('synchronously, before its target round'), ' (the witness refuses if the target is already public), plus the open and seal. The per-trial co-sign latency is masked in the UI by a brief “sensing” animation.']],
    ]),

    h2('time', 'Trusted time — three layers'),
    ul([
      [b('Per attestation: a drand round '), 'the witness fetched and BLS-verified itself, so ', code('witnessRound < targetRound'), ' is the publicly re-checkable timing fact for precognition.'],
      [b('Feed head: a free RFC 3161 TSA '), '— an independent party whose timestamp the experimenter cannot forge, so even a single owner-run witness is un-backdatable to TSA granularity.'],
      [b('Long-term: OpenTimestamps / Bitcoin '), 'via the main ledger’s ', code('witness.anchor'), ' entry, freezing the feed permanently.'],
    ]),

    h2('binding', 'How it binds in — additive only'),
    p(
      'An attestation covers a canonical ', code('witnessStatement'),
      ' and is stored as ', b('new optional fields'),
      ' on the seal (', code('witnessed'), ', ', code('witness.{open,seal}'),
      ', and micro-PK ', code('checkpoints[]'),
      ') and on each precognition trial. The pre-commitment, experiment hash, trial commit, and target derivation are ',
      b('unchanged'),
      ', so every previously sealed session still verifies byte-for-byte and an un-witnessed seal is byte-identical to the pre-D16 format. The witness feed is a sibling hash-chained log, cross-referenced from the main ledger.',
    ),

    h2('honesty', 'The honest limit'),
    warn(
      'A single witness the experimenter also runs is not independence on its own. That is exactly why the time anchor is externally rooted: at N=1 with the owner running the only node, the un-forgeable root is the ',
      b('RFC 3161 TSA'),
      ' (and OTS/Bitcoin long-term), not the node itself — so backdating is bounded to TSA granularity even then. Strength scales with genuinely independent peers, and the project invites anyone to run one. Full accounting in the ',
      link(P.threat, 'threat model'), '.',
    ),
  ];
}

export function renderThreat(): Child[] {
  return [
    lead(
      'Stating the residual trust openly is itself part of the credibility. This is the honest frontier: what the design closes, and what it does not (yet).',
    ),

    h2('closed', 'Closed'),
    defs([
      ['Faking / cherry-picking results', ['Pre-commitment + signatures + hash chain + beacon + external anchor make it impossible to precompute favourable runs, drop bad ones, or backdate anything without visibly breaking the chain or contradicting the beacon. See ', link(P.provenance, 'the spine'), '.']],
      ['Parallel runs (micro-PK)', ['Closed by ', link(P.witnesses, 'live witnesses'), ': the open, every checkpoint, and the seal are co-signed in real time, and the sealed commitment must continue the witnessed prefixes. What remains is ', b('abandon-and-retry'), ', now concretely auditable — every witnessed open with no seal shows in the independent feed, and each retry burns a fresh public beacon + open.']],
      ['Choice-timing / backdating (precognition)', ['Closed by live witnesses: a witness co-signs each choice commit while its target round is still in the future (', code('witnessRound < targetRound'), ', refusing otherwise), so the choice provably precedes the target.']],
    ]),

    h2('residual', 'Honest residuals'),
    ul([
      [b('Witness independence. '), 'Witnesses help only to the degree they are independent of the experimenter. Against a server colluding with ', em('every'), ' witness, only an M-of-N quorum of genuinely independent witnesses (≤ N−M colluding) helps — and we are deployed at N=1 today. The mitigation at N=1 is the externally-rooted ', link(P.witnesses, 'TSA time anchor'), '; the long-term fix is federation.'],
      [b('Entropy-source integrity. '), 'Whether the hardware is genuinely physical and unmanipulated is a separate axis from provenance, handled by ', link(P.entropy, 'calibration, the randomness test suites, and open/auditable hardware'), '.'],
      [b('Published code == running code. '), 'Mitigated by open source + reproducible build hashes; to be hardened later with remote attestation.'],
    ]),
    callout(
      'None of these let the experimenter manufacture a ', em('false positive'),
      ' that survives the confirmatory phase. The strongest claim still requires a flagged ',
      link(P.psiScore, 'candidate'),
      ' to replicate under a fresh, pre-registered protocol — which no amount of server-side mischief can fake.',
    ),
  ];
}

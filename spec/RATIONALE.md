# PsiMeter — Design Rationale & Decision Log (Informative)

> **Status: Informative companion to the normative specification.** This document records the
> *reasoning* behind PsiMeter — the design pillars, the two hypotheses (H1/H2), the **decision log
> (D1–D16)**, the threat model and residual-trust accounting, and the original design narrative.
> **It is not normative.** The normative protocol — canonical data formats, cryptography, ledger,
> experiment kinds, scoring, the witness protocol, and the verification procedure — lives in
> [`psimeter-protocol.md`](psimeter-protocol.md), which is authoritative: wherever an older sketch
> below (notably the provenance flow in §7 and the architecture/ledger sketches in §8) differs from
> the protocol spec, **the protocol spec wins**. Those sections are retained as design history and an
> accessible narrative; section-number references here are to *this* document's own numbering, not the
> protocol spec's.
>
> **Last updated:** 2026-06-21 (migrated from `docs/SPECIFICATION.md`; content otherwise unchanged).

---

## 1. Overview

PsiMeter is an open-source platform for large-scale, anonymous, web-based experiments that test for putative "psi" effects — specifically:

- **Micro-psychokinesis (micro-PK):** whether a human observer can, by intention alone, bias the output of a random process (e.g. the proportion of 1s in a stream of random bits).
- **Precognition (forced-choice):** whether an observer can anticipate a future random outcome better than chance (e.g. choosing one of two colors before the target is generated).

Sessions run **server-side**; the client receives a **one-way stream** purely for visual feedback (planned: three.js). The platform is designed to host **many experiment types** over time.

**The bar:** the methodology and implementation must withstand adversarial scrutiny from a skeptical scientist or journal reviewer. The dataset is intended to support a peer-reviewed publication and will be released publicly under an open license.

### Lineage / prior art
- Princeton Engineering Anomalies Research (PEAR) micro-PK REG experiments.
- Global Consciousness Project (GCP).
- Rhine-style forced-choice ESP / precognition paradigms.
- Meta-analytic critiques (e.g. Bösch, Steinkamp & Boller, *Psychological Bulletin*, 2006) — these critiques (baseline bias, optional stopping, selective reporting, multiple comparisons) are precisely what our design must pre-empt.

---

## 2. Core design pillars

These are the load-bearing principles. Every feature is judged against them.

1. **The experimenter is an untrusted party.** A credible result cannot require anyone to trust the server operator (you, me, or the host). An independent auditor must be able to verify the results from published artifacts alone. This single principle drives most of the cryptographic design below.
2. **Pre-commitment over post-hoc.** Every prediction (intended direction, target choice, sample size) is cryptographically committed *before* the random data exists. No optional stopping, no after-the-fact selection of which sessions "count."
3. **Full provenance & tamper-evidence.** Every session is recorded in an append-only, hash-chained log whose head is periodically anchored to an external, independent timestamp. The dataset cannot be silently edited, reordered, or pruned.
4. **Reproducible analysis.** Raw data + deterministic, versioned analysis code → anyone re-runs it and gets identical numbers. Collection code and analysis code are separate.
5. **One-way isolation of the generator.** During a run, the random-generation process reads **nothing** from the client. Isolation is enforced architecturally, not by policy.
6. **Honest aggregate inference.** The scientific claim lives in a single, pre-registered, corpus-level test — never in a cherry-picked individual session. Engagement features (e.g. the leaderboard) must not be confusable with evidence.
7. **Open by default.** Code, protocol, pre-registration, and (eventually) raw data are public.

---

## 3. Glossary (working definitions)

| Term | Meaning |
|---|---|
| **Experiment** | A type/protocol (e.g. "binary micro-PK", "two-color precognition"). |
| **Session / Run** | One execution of an experiment by one operator, fixed duration/length. |
| **Operator** | The (anonymous/pseudonymous) person performing a session. |
| **Intention / Direction** | The pre-declared target of a micro-PK run (e.g. HIGH / LOW / BASELINE). |
| **Anchor** | A short, human-visible value shown to the operator, cryptographically derived from (and committing to) the run's pre-commitment. The public "fingerprint" of the run. |
| **Commitment** | A hash published *before* generation that binds the prediction + parameters, without revealing the data. |
| **Reveal** | Post-run publication of the values that let anyone verify the commitment. |
| **Beacon** | An external public randomness source (e.g. NIST Randomness Beacon, drand/League of Entropy) whose value did not exist before the run started. |
| **Baseline / Calibration** | Runs generated by the *identical* pipeline with no operator intention, used to characterize the generator's true behavior. |
| **Sigma / Z** | Standardized deviation of a run's outcome from chance expectation. |
| **Trial** | A single forced-choice event (precognition) or a fixed block of raw bits (micro-PK). |

---

## 4. Requirements captured from the brief (v1)

Stated by the project owner; recorded verbatim-in-spirit, to be refined:

- Anonymous, web-based; anyone worldwide can run unlimited sessions.
- Each session has a fixed short duration (~3–5 min).
- Generation runs **server-side**; client gets a **one-way** stream for visual feedback.
- Per-session identifier; **every** session is recorded and stored.
- An **anchor** value is shown to the operator, derived from the commitment (the raw stream is *not* shown).
- On completion, compute the deviation (**sigma**) from the expected distribution and log it.
- A **leaderboard** of anomalous sessions (count + sigma).
- Client-side **three.js** (or similar) visual representation with a real-time anomaly cue.
- Operator journey: enter → choose experiment → read instructions → start → see anchor + timer + live visualization.
- **First experiment:** binary 0/1 generation, expected ~50/50.
- **Second experiment (example):** two-color precognition (choose a color, target appears within ~5 s).
- Platform must support **multiple experiment types**.
- **v1 runs locally**; cloud (likely AWS) is a later phase.
- Dataset released publicly after a collection period.

---

## 5. Hypotheses under test (primary)

The platform is built to test two distinct, pre-registered hypotheses. They are deliberately separated because they demand different analyses and different safeguards.

### H1 — Individual consistency ("some people can reliably influence the RNG")
The claim is **not** "anomalies occur" (they will, by chance) but that **specific individuals produce above-chance deviation *consistently across their own sessions*.**
- **Requires** persistent pseudonymous operator identity (D6).
- **Clean unit of analysis:** the **within-operator HIGH−LOW difference** (same person, interleaved intentions ⇒ any static per-operator/per-condition quirk cancels; only intention differs).
- **Primary statistic:** within-operator effect with a credible interval, plus **split-half / test–retest reliability** — does an operator's effect in the first half of their sessions predict the second half? A stable ability ⇒ positive correlation. This is very hard to fake or to produce by chance.
- **Multiple-comparisons guard:** screening thousands of operators will throw up chance "talents." Therefore a **two-phase design** (below): candidates flagged in the exploratory phase are re-tested under a frozen, pre-registered, fixed-N confirmatory protocol. Only the replication counts as confirmatory.
- **Public surface:** this per-operator statistic is the gamified **psi score** (D15) — an anytime-valid test martingale, ranked on the leaderboard, with a "candidate" flag that triggers (only) the confirmatory replication.

### H2 — Excess corpus-level deviation ("more anomalies than chance allows")
Across the large corpus, does the distribution of session scores deviate from the **empirically calibrated** null (mean shift, variance inflation, and tail-excess of |Z|>3, 4, 5)?
- **Comparison is intention-runs vs operator-absent baseline runs through the identical pipeline** (D5) — never against a merely assumed N(0,1), because a real hardware source has its own measured bias.
- **Directional:** the HIGH−LOW contrast is the headline effect (cancels static bias).
- **Dominant-operator robustness (the "PEAR Operator 10" risk):** pre-register a **leave-one-operator-out** and **per-operator-capped** analysis so no single heavy (or fraudulent) user can manufacture the corpus result.

### Two-phase architecture (applies to both)
- **Exploratory / screening corpus** — open firehose; anyone, unlimited sessions; generates hypotheses and flags candidate operators/effects. Pre-registered as exploratory; **never** cited as confirmation.
- **Confirmatory corpus** — frozen hypotheses, fixed N, defined stopping rule, analysis script registered *before* the data is generated. For H2: a pre-declared block/time-window analyzed once. For H1: replication of screened candidates.

---

## 6. Decision log

Each item: the question, options, my recommendation, and status. **OPEN** items need the project owner's input before they affect build work.

### D1 — Entropy source(s) `DECIDED`
**Decision:** The flagship micro-PK experiment uses a **live physical (true) entropy source** — thermal/quantum noise — because only a physical process can, even in principle, be influenced moment-to-moment by intention. A seeded PRNG/CSPRNG is **excluded** for the confirmatory micro-PK arm (deterministic after seeding ⇒ nothing to influence).

**Entropy ladder (credibility / auditability, low → high):**
1. **OS entropy** (`getrandom` / `/dev/urandom` / `BCryptGenRandom`) — a *CSPRNG seeded from hardware*, deterministic after seeding. **CI / plumbing only; NON-CONFIRMATORY, and not even valid for personal piloting.**
2. **CPU entropy instruction** (`RDSEED`) — the CPU's on-die thermal-noise entropy source (distinct from `RDRAND`, a CSPRNG reseeded by it). A genuine **physical, nondeterministic** source already present in the owner's PC, **free**. Whitened on-die and vendor-opaque ⇒ good for **local self-testing / single-operator pilots**, but not the most auditable choice for publication.
3. **Open-hardware USB TRNG** (e.g. *Infinite Noise TRNG* ≈ $35 or *OneRNG* ≈ $50 — both **open hardware + open firmware**; or *TrueRNG* ≈ $50) — avalanche/thermal noise over USB. Within hobbyist budget and **auditable because the design is public**. The realistic bridge to credible data collection without a grant.
4. **Quantum RNG (QRNG)** — samples an irreducibly indeterministic quantum process; the most defensible source and the eventual confirmatory target (D11), but the priciest.

**Build plan:** Define one `EntropySource` interface with three implementations from day one: `OsEntropySource` (CI/plumbing, tagged non-confirmatory), `RdseedEntropySource` (real physical, for the owner's local self-testing), and a `UsbTrngSource` adapter for open-hardware devices when acquired. **Every session records the exact source, device, firmware/version, and sampling parameters.** Beacon-seeded reproducible RNG is retained only for the *precognition* experiments, never for micro-PK.

### D2 — Provenance & anti-fraud spine `DECIDED (accepted)` — see §7 for the full flow
Make the experimenter un-trustable-away:
- **Commit–reveal:** before a run, publish `precommit = H(experimentId ‖ version ‖ experimentHash ‖ intention ‖ operator_pubkey ‖ beacon ‖ session_id ‖ nonce ‖ prev_head)` — the exact parameter set is bound via `experimentHash` (D13). The **anchor** is derived from this. After the run, reveal the inputs; anyone verifies.
- **Streaming commitment to raw output:** because a true RNG cannot be reproduced from a seed, the raw stream is committed *as it is produced* (rolling/Merkle root) so it cannot be altered or cherry-picked after the fact. (This replaces "commit the seed" for the physical-source case.)
- **Public beacon:** bind each run to a beacon value (NIST / drand) so the record provably did not exist before the run started — prevents pre-computation / selective generation by the server. *Beacon choice (2026-06-17):* drand **quicknet** (unchained, 3 s, League of Entropy), each pulse **BLS-verified in-process** against the hardcoded group public key before it is bound — the server never trusts the drand endpoint for authenticity. Switched from the older chained mainnet (free now: no confirmatory data exists yet) because unchained verification is simpler — the signed message is `H(round)`, with no previous-signature dependency.
- **Hash-chained append-only log:** each session record includes the hash of the previous → tamper-evident ledger.
- **External anchoring:** periodically publish the ledger head to an independent, hard-to-forge timestamp (RFC 3161 TSA, a public git repo, and/or OpenTimestamps/Bitcoin) so the whole corpus is frozen in time.

### D3 — Pre-registration & run protocol `DECIDED (accepted)`
- **Fixed sample size per session, no optional stopping.** Analysis always uses the complete pre-declared run.
- **Tripolar micro-PK protocol:** each run is assigned/declared HIGH, LOW, or BASELINE *before* it starts; the confirmatory test compares HIGH vs LOW (and vs BASELINE), which cancels static generator bias.
- **One pre-registered primary hypothesis + test statistic** per experiment, published (e.g. OSF) before confirmatory data collection. Everything else is explicitly **exploratory**.
- Serves both primary hypotheses (§5): **H1** (individuals influence the RNG *consistently*) and **H2** (the corpus shows *more* deviation than the calibrated null predicts).

### D4 — Leaderboard framing `DECIDED (accepted)`
- With millions of sessions, multi-sigma runs are **guaranteed by chance** even if no effect exists. A naive "anomaly leaderboard" would be statistically empty and would actively discredit the project.
- Keep it as an *engagement / transparency* feature, but present every individual result against the expected null distribution, and make the headline science the **aggregate pre-registered test**. Never imply an individual high-sigma run is evidence of psi.

### D5 — Baseline / calibration `DECIDED (accepted)`
- Characterize the generator with large **operator-absent** runs produced by the **identical** code path; use the *empirical* mean / variance / autocorrelation (not assumed 0.5 / theoretical variance) when they differ.
- Interleave or schedule control runs continuously, not once.
- Run continuous randomness test suites (NIST SP 800-22 STS, Dieharder, TestU01) on baseline output; a compromised/biased source shows up here first.

### D6 — Operator identity model `DECIDED — core adopted; sub-details OPEN`
H1 *requires* linking many sessions to the same person, so we need a **persistent, pseudonymous operator key**: a high-entropy random credential (keypair) generated and held client-side, no PII, that lets an operator accumulate sessions and "return," and that **signs** each pre-commitment (non-repudiation). Open sub-details: Sybil / multi-ID handling, optional stronger identity for the confirmatory individual-ability cohort, and per-operator session caps (H1 robustness, §5). Fully anonymous one-off sessions remain allowed but flow only into the exploratory corpus.

### D7 — Ethics, governance, licensing `OPEN / flag`
Even anonymous online human-subjects data often needs an ethics/IRB review for journal acceptance; we'll also need an informed-consent screen and a data-release license. Flagging now; decide before launch.

### D8 — Technology stack `DECIDED`
**TypeScript/Node** for server (HTTP + one-way WebSocket, session state machine, generation loop, persistence) and **client** (three.js). **Rust** for a minimal *entropy-provider sidecar* (raw `os` | `rdseed` | `usb-trng` bytes + metadata/health) — the one place a systems language earns its keep (direct, auditable hardware access). **Python** for the separate, versioned analysis pipeline. The *trust-path principle* that makes the backend language scientifically neutral is in §8.1. Primitives: SHA-256, Ed25519, domain-separated Merkle, RFC 8785 JCS canonical JSON.

### D9 — Abuse / automation handling `OPEN`
Unlimited anonymous access invites bots and leaderboard-gaming. Note: because generation is isolated from the client, a bot **cannot bias an individual run** — it can only inflate volume. Plan: rate limiting + separating "attended" from "firehose" sessions in analysis. Details TBD.

### D10 — Raw vs conditioned bits `DECIDED — RAW`
Hardware sources are normally *whitened* (von Neumann / hashing) to remove bias — but conditioning could also wash out the tiny intention signal we are hunting. **Recommendation:** capture **raw, unconditioned** samples, document the exact sampling, **calibrate the static bias relentlessly** (D5), and rely on the HIGH−LOW differential to cancel it. Freeze the bit-to-trial mapping (e.g. a "trial" = sum of K raw bits) and never change it after launch.

### D11 — Confirmatory hardware device `OPEN (recommend open-hardware TRNG now → QRNG later)`
No budget exists day one. Path: (1) **today, $0** — pilot on `RDSEED` (real physical, in the owner's CPU); (2) **~$35–50** — add an open-hardware USB TRNG (*Infinite Noise* / *OneRNG*) for auditable, citable early data; (3) **later** — a quantum RNG for the flagship confirmatory dataset. Source-agnostic design now; device choice locked before Phase 3 confirmatory collection.

### D12 — Experimenter-as-subject safeguards `OPEN (recommend adopt)`
The project owner self-identifies as a putative RNG-influencer and will also be a test subject. This is a known credibility risk (cf. PEAR "Operator 10"). Safeguards:
- The owner uses an ordinary **pseudonymous operator key**; their sessions are pre-committed/immutable like everyone's.
- **Pre-register that the owner's own data is analyzed and reported separately** and is always subject to the leave-one-out and per-operator-cap robustness checks, so it can never drive the headline corpus result.
- Ideally an **independent party co-holds/co-signs** the confirmatory analysis script and the ledger anchors.
- *Framed positively:* the same machinery that defends against a fraudulent experimenter also protects the owner from self-deception — which is the stated goal (prove **or** disprove).

### D13 — Experiment parameters & configurability `DECIDED`
Parameters are **configurable but versioned & immutable once published.** Each experiment is an `ExperimentDefinition` (`id` + integer `version` + param block, integers/strings only) whose content hash is bound into every session's pre-commitment (D2/§8.5). Changing any value **bumps the version and changes the hash**, so configurability never becomes a hidden experimenter degree of freedom: every change is transparent, timestamped, and partitions the corpus (incompatible parameter sets are never pooled). Pre-registration names which `(id, version)` is confirmatory. Definitions live in `experiments/<id>-v<version>.json`.

**`binary-micropk v1` defaults — anchored to the PEAR benchmark REG protocol:**
- `trialBits = 200` → a trial is Binomial(200, ½): mean 100, SD = √50 ≈ 7.071.
- `bitRatePerSec = 1000`, `sessionSeconds = 180` ⇒ `trialsPerSession = 900`, `bitsPerSession = 180,000`.
- Tripolar HIGH/LOW/BASELINE (D3); `intentionAssignment = volitional` (PEAR also ran "instructed" — this is itself a parameter); raw/unconditioned (D10); `checkpointEveryTrials = 5` (~1 s visual cadence).

**Honest power note (a credibility feature, not a caveat to bury):** the canonical micro-PK effect is ≈1–2×10⁻⁴ per bit. A single 180k-bit session has SD ≈ √(0.25/180000) ≈ 1.18×10⁻³ in proportion, so a canonical-size effect contributes only z ≈ 0.13 to one session — **negligible.** All real inference therefore lives in *aggregation* (Stouffer-combined across many sessions/operators). This is exactly why the platform is built for scale, why an individual high-σ session is not evidence (D4), and why H1 requires each candidate operator to contribute many sessions.

### D14 — Multiple experiment kinds & the presentiment target source `DECIDED`
The platform hosts **multiple experiment kinds** behind one shared provenance spine (commit → sign → beacon → Merkle → ledger → anchor); only the choice vocabulary, the generation/reveal protocol, and the scoring differ per kind (a thin registry in `packages/core/kinds.ts` + `packages/server/src/kinds/*`). Two kinds exist: `micro-pk-binary` (D13) and `precognition-presentiment` (§7.5).
- **Committed-field compatibility:** the per-session pre-commitment keeps the JSON key `intention` (type widened to a generic string) so every previously sealed micro-PK session still verifies byte-for-byte. Kinds whose choices are per-trial (precognition) commit no session-level choice (`intention = ""`).
- **Presentiment target source = future drand round only** (not future-round + post-choice physical entropy). Rationale: a target derived purely from `B_R` is reproducible by *anyone* with zero trust in the server's entropy — maximal auditability, simplest verification — which outweighs adding a physical-RNG element that only the server could reproduce.
- **Fixed N, not a score-dependent timebox:** a presentiment session is a fixed number of trials sized to ≈2 minutes, preserving D3 (no optional stopping).
- **The presentiment stimulus is a real affective image, and the corpus is content-hash-pinned.** Presentiment requires a stimulus that genuinely evokes emotion, so each trial reveals a curated **CC0 image** (calm vs safe-but-aversive). The corpus lives in `stimuli/` and is hashed into the definition (`{path, sha256}` per image) by `scripts/build-stimuli.mjs`, so the definition hash pins the exact pixels; verifiers re-hash the served bytes. Strong/aversive content is gated behind a one-time **content-warning consent** (def `contentWarning`). v1 ships a modest starter corpus (`stimuli/CREDITS.md`), expandable by dropping images in and rebuilding.

### D15 — Public per-operator evidence: the "psi score" `DECIDED`
The leaderboard's unit is the **person, not the session.** Anomalous single sessions are guaranteed by chance (D4) and prove nothing; the thing worth surfacing is an operator who beats chance **consistently, in their declared direction, across their own sessions** — i.e. **H1** (§5), made public and gamified.

**Statistic — an anytime-valid test martingale (e-value), not a fixed-N z.** The score updates live after every session and players will naturally stop at a favourable peak — *operator-level optional stopping*, the exact failure mode D3 forbids within a session. A test martingale is **anytime-valid**: under H0 its "wealth" `W` is a non-negative martingale with `E[W]=1`, so by **Ville's inequality** `P( sup_t W_t ≥ 1/α ) ≤ α`. You may monitor it live, stop whenever, and even rank the leaderboard by *peak* wealth — the false-positive guarantee still holds. This is the one construction that makes a live, gamified, continuously-updated per-person evidence score scientifically legitimate.

**Construction (kind-agnostic).** Each scored session contributes a *directional* per-session z `d_i` (micro-PK HIGH→+z, LOW→−z; BASELINE calibrates and is excluded, D5; precognition's hit-rate z is already oriented). Under H0, `d_i ~ N(0,1)`. We bet against H0 with a fixed **one-sided mixture** over a grid of alternative per-session effects: `W = mean_j exp(δ_j·S − n·δ_j²/2)` with `S = Σ d_i`, grid `PSI_ALT_GRID = [0.1, 0.2, 0.4, 0.8]`, equal weights. Each component is a martingale (`E[exp(δZ−δ²/2)]=1`), so the mixture is too; one-sided (all δ>0) so only declared-direction effect builds wealth. **Any fixed grid is valid (Ville) — the grid affects power, never validity.** Implemented in `packages/core/src/psi.ts` (display) and recomputed authoritatively in `analysis/analyze.py` (§8.1); a frozen wealth golden vector in the core tests guards cross-language parity.

**Display & ladder (gamification).** `points = 10·log10(W)` — **decibans** of evidence (I.J. Good's weight of evidence), so 0 at chance and +10 per 10× of evidence; plus **odds against chance** (`W : 1`) and a **sigma-equivalent** (`Φ⁻¹(1−1/W)`). Tiers: Baseline · Flicker (W≥3) · Signal (≥10) · Strong signal (≥100) · **Candidate** (≥1000).

**Threshold is SCREENING, never proof (D4, §5 two-phase).** "Candidate" requires `W ≥ 1000` (anytime-valid one-tailed p ≤ 10⁻³) **and** ≥ 5 scored sessions (consistency, not one lucky run, D13). It explicitly means *"flagged for a separate, pre-registered, fixed-N confirmatory replication"* — never "proven psi." The leaderboard shows the **expected-by-chance candidate count** (`eligibleOperators / 1000`): with many players some candidates are expected, which is precisely why a candidate must replicate. All public copy is candidate-not-proof.

**Residual risks & hardening.** (a) *Static-bias confound (micro-PK only):* directional z is taken vs the fair-coin 0.5, so a one-sided-intention operator could accrue wealth from a biased source (D10) rather than psi — mitigated by HIGH/LOW balance; the confirmatory analysis centers on the empirically calibrated baseline and the HIGH−LOW contrast (D5/§5). Precognition is unaffected (exact beacon-derived fair coin, D14). (b) *Sybil / multi-key fishing (D6/D9):* minting many browser keys buys more lottery tickets for a high score; answered by the confirmatory phase + optional stronger identity for flagged candidates, not on the firehose. (c) *Experimenter-as-subject (D12):* the score is **recomputable from the public ledger by anyone**, never server-asserted, so the owner topping his own leaderboard is independently checkable. For confirmatory use, the grid and threshold should migrate into the **hash-bound experiment definition** (D13) so they can never become a hidden experimenter degree of freedom.

**Opt-in candidate contact.** Crossing the threshold unlocks a voluntary form: the operator **signs a canonical challenge** (proving custody of the key whose public score earned eligibility), the server re-derives eligibility from the ledger, and the chosen contact detail is stored in a **private, off-ledger** log (git-ignored, never on the public chain, never returned by any GET). This is the single, deliberate, operator-initiated break in pseudonymity (everything else stays anonymous).

### D16 — Live witnesses: closing the parallel-runs & choice-timing residuals `DECIDED`
Two attacks survived the §7.4 accounting because the experiment server *alone* produced every artifact: (1) **parallel runs** (micro-PK) — privately roll several physical streams for one pre-committed session and seal only the flattering one; (2) **choice-timing / backdating** (precognition, §7.5) — lie about *when* a forced choice arrived, so it no longer provably precedes its target beacon round. Both are closed by **independent live witnesses** that co-sign artifacts in real time.

**Witness model — M-of-N capable, deployed at N=1.** A *witness* is an independent process (its own Ed25519 key, host, ideally operator) that co-signs a subject and publishes it to its **own** append-only, hash-chained feed. Verifiers (`analyze.py` and `/verify`) count **≥ M of N trusted witnesses** — the trusted set is the *auditor's* published list (like the hardcoded drand group key), never the server's say-so. The protocol + verifiers are M-of-N from day one, deployed at **N=1/M=1** (one node, runnable by anyone from the open-source repo via `npm run witness`); adding federated peers is config, not code. *Honest limit:* a single witness the experimenter also runs is not independence on its own — which is exactly why the time anchor is externally rooted (below).

**Trusted time — drand round (per attestation) + RFC 3161 TSA (feed head) + OTS/Bitcoin (long-term).** Each attestation binds a drand round the witness fetched and **BLS-verified itself**; `witnessRound < targetRound` is the publicly re-checkable timing fact for precognition. The witness periodically stamps its feed head with a **free, configurable RFC 3161 TSA** — an independent party whose timestamp the experimenter cannot forge, so even a single owner-run witness is un-backdatable to TSA granularity. OTS/Bitcoin (via the main ledger's `witness.anchor` + `npm run anchor`) freezes the feed long-term. In-code verification re-checks the witness **Ed25519 signature + the drand-round ordering + the TSA token's messageImprint/genTime** (a DER walk); full TSA-token cryptographic validation is one standard command (`openssl ts -verify`), mirroring how we emit `.ots` for `ots verify`.

**What is witnessed.** *Micro-PK:* the session **open**, **every live checkpoint root**, and the **seal** — and the sealed `outputCommitment` must be the Merkle continuation of the witnessed checkpoint prefixes (recomputable from the published raw blob), so a privately-rolled alternate stream cannot be substituted at seal. *Precognition:* **each forced-choice commit, synchronously, before its target round** (the witness refuses if the target is already public), plus the open and seal. Per-trial synchronous co-signing adds a little latency, masked in the UI by a "sensing" reveal animation.

**How it binds in — additive only, no committed-field break.** An attestation is `{witnessPubKey, witnessRound, witnessChainHash, witnessSig, feedSeq, feedEntryHash}` over the canonical `witnessStatement{subjectHash, sessionId, trialIndex?, kind, witnessRound, witnessChainHash, witnessPubKey}` (`packages/core/src/witness.ts`, with a frozen golden vector). Attestations are stored as **new optional fields** on the seal (`witnessed`, `witness.{threshold,keys,open,seal}`, and micro-PK `checkpoints[]`) and on each precognition trial record (`witness[]`); `PrecommitInput`/`buildPrecommit`, `experimentHash`, `trialCommit`, and `derivePresentimentTarget` are **unchanged**, so every previously sealed session still verifies byte-for-byte and an un-witnessed seal is byte-identical to the pre-D16 format. The witness feed is a *sibling* hash-chained log (`witness.attest` entries) verified by the same core machinery; the main ledger cross-references the witness feed head via a `witness.anchor` entry.

**Configuration & honesty.** Witnessing is opt-in via `PSIMETER_WITNESS=url[,url]` + `PSIMETER_WITNESS_THRESHOLD`; unset → sessions seal `witnessed:false` (the old behavior) and are **never pooled** with witnessed confirmatory data. For confirmatory use the trusted witness key-set + threshold should migrate into the **hash-bound experiment definition** (D13), like the psi grid (D15). The reference node is `packages/witness`.

---

## 7. Provenance & verification flow

This is the spine. It must make the following true: an independent auditor, months later, **with only the public log**, can verify that (a) each session's intention was fixed *before* any randomness existed, (b) the random data was not altered or cherry-picked, (c) the session happened *after* a known public moment, (d) nothing was inserted, removed, reordered, or backdated in the corpus, and (e) every published statistic is reproducible.

### 7.1 Sequence (micro-PK)

```mermaid
sequenceDiagram
    autonumber
    participant Op as Operator (client)
    participant Srv as Server (orchestrator)
    participant Gen as Generator (isolated)
    participant Ent as EntropySource (physical)
    participant Bcn as Public Beacon
    participant Led as Append-only Ledger

    Note over Op,Led: Phase A — Pre-commitment (no randomness exists yet)
    Op->>Srv: choose experiment + declare intention (HIGH / LOW / BASELINE)
    Srv->>Bcn: fetch latest pulse B_t  (proves "not before T")
    Srv->>Srv: precommit = H(exp ‖ params ‖ intention ‖ op_pubkey ‖ B_t ‖ session_id ‖ nonce ‖ prev_head)
    Srv->>Op: anchor = short human encoding of precommit  (operator records it)
    Op->>Srv: op_sig = Sign(precommit) with operator private key
    Srv->>Led: append OPEN record (precommit, op_sig) → new head published

    Note over Op,Led: Phase B — Generation (one-way; reads nothing from client)
    loop fixed N samples, fixed rate, NO optional stopping
        Gen->>Ent: pull raw sample
        Ent-->>Gen: physical noise bit(s)
        Gen->>Gen: fold sample into rolling Merkle commitment
        Gen-->>Op: checkpoint root + visual frame (one-way only)
    end
    Gen->>Srv: C_out = MerkleRoot(all raw samples)

    Note over Op,Led: Phase C — Reveal & seal
    Srv->>Srv: compute stats vs CALIBRATED baseline (count, Z, ...)
    Srv->>Led: append SEALED record (precommit, C_out, checkpoints, stats, raw-blob ref) → head published
    Srv->>Bcn: periodically anchor ledger head externally (RFC3161 TSA / public git / OpenTimestamps)

    Note over Op,Led: Verification (anyone, later, from public artifacts only)
    Led-->>Op: recompute precommit · verify op_sig · check beacon time · recompute C_out from raw blob · verify chain · re-run analysis
```

### 7.2 What each move buys us
- **Declare-then-sign-then-log (Phase A)** freezes the intention, parameters, and operator identity *before a single random bit exists*, and timestamps them in the chain. The server cannot retro-edit the intention without breaking `op_sig`; the operator cannot later deny it.
- **The anchor** the operator sees is a short encoding of `precommit`. It is the "number derived from the seed" from the brief — but derived from the *commitment*, which is strictly stronger: it binds intention + parameters + freshness, not just a seed. The operator can screenshot it as personal proof of exactly what they committed to.
- **Beacon binding** proves the session record did not exist before the beacon's publication time → the server could not have pre-computed a library of runs and kept only flattering ones from before T.
- **Streaming Merkle commitment (Phase B)** is what replaces "commit the seed" for a non-reproducible physical source: the raw stream is pinned *as it is produced*. The one-way checkpoints sent to the client also let the client act as a lightweight witness that the stream existed live.
- **Seal + hash-chain + external anchor (Phase C)** make the corpus append-only and frozen in time: no silent insertion, deletion, reordering, or backdating.

### 7.3 Auditor verification (from public artifacts only)
1. Recompute `precommit` from revealed fields; verify `op_sig` against `op_pubkey`. → intention & params were fixed and operator-authenticated.
2. Confirm the OPEN record precedes the SEALED record in the chain, and that `B_t` matches the public beacon archive at time `T`. → intention pre-dated the data; session is fresh.
3. Recompute `C_out = MerkleRoot(raw blob)`; check it equals the sealed value and that streamed checkpoints are consistent prefixes. → data was not altered or cherry-picked.
4. Walk the hash chain; confirm the head matches the externally anchored timestamps. → nothing inserted/removed/reordered/backdated.
5. Re-run the published deterministic analysis over the raw blobs; reproduce every statistic. → analysis is honest.

### 7.4 Honest residual-trust accounting
*Stating these openly is itself part of the credibility.*
- **The "parallel runs" attack (micro-PK) — CLOSED by live witnesses (D16).** A malicious server could in principle roll several physical streams for one pre-committed session and seal only the favorable one. An independent witness now co-signs the **open, every live checkpoint root, and the seal** in real time (binding a fresh self-verified drand round), and the sealed `outputCommitment` must be the Merkle continuation of the witnessed prefixes — so a privately-cherry-picked stream cannot be substituted. What remains is **abandon-and-retry**, now concretely auditable: every witnessed open with no seal shows in the independent witness feed (a started-but-unsealed pattern), and each retry burns a fresh public beacon + open.
- **Choice-timing / backdating (precognition) — CLOSED by live witnesses (D16, §7.5).** An independent witness co-signs each forced-choice commit while its target round is still in the future (`witnessRound < targetRound`; the witness refuses otherwise), so the choice provably precedes the target.
- **NEW residual — witness independence.** Witnesses help only to the degree they are independent of the experimenter. Against a server colluding with *every* witness, only an **M-of-N quorum of genuinely independent witnesses** (≤ N−M colluding) helps; the protocol is M-of-N from day one but is deployed at **N=1** today. At N=1 with the owner running the only node, the un-forgeable time root is the **RFC 3161 TSA** (and OTS/Bitcoin long-term), *not* the node itself — so backdating is bounded to TSA granularity even then. Sessions with no co-signature are flagged `witnessed:false` and never pooled with witnessed confirmatory data. *This is the honest frontier: strength scales with independent peers + the TSA, and the README invites anyone to run a witness.*
- **Entropy-source integrity** (is the hardware genuinely physical and unmanipulated?) is a separate axis, handled by D5 calibration, the continuous randomness test suites, and open/auditable hardware.
- **Published code == running code.** Mitigated by open source + reproducible build hashes; hardened later with remote attestation (Phase 3).

### 7.5 Precognition variant — presentiment `BUILT`
Tests the owner's hypothesis (the Bem/Bierman presentiment paradigm): that some people feel an event's **emotional valence before it happens**. A session is ~2 minutes of **fixed-N forced-choice trials**. Each trial the operator is *destined* to be shown either a **calming** or an **aversive real image** — selected by a future beacon round, so it does not yet exist — and must, **before it appears**, predict the valence they sense is coming. Then the actual image is shown full-screen (~4 s) so the emotion genuinely lands. A hit is correctly anticipating the valence that then hits them. We hunt for individuals who beat chance **consistently** — **H1** (per-operator hit-rate + split-half reliability), never a one-session result. A one-time **content-warning consent gate** precedes the session (the def carries a `contentWarning`).

The crux that an earlier version got wrong: the reveal must be a *real affective stimulus*, not a label — there must be something to actually feel. The stimuli are a **curated CC0 image corpus** in two valence pools, and the corpus is **part of the content-hashed experiment definition** (each image listed as `{path, sha256}`), so the definition hash — bound into the pre-commitment — pins the exact pixels of every possible stimulus. Build/refresh with `scripts/build-stimuli.mjs`.

Per-trial sequence (`packages/server/src/kinds/precog.ts`), two-way WebSocket:
1. server → `trial`; the operator feels and predicts.
2. client → `choice`; the server reads the latest beacon round `R0` and binds a **future** target round `R = R0 + offset`.
3. server → `pending {R, R0}`; the client signs `commitHash{sessionId, trialIndex, choice, R, R0, operatorPubKey}` (Ed25519) and returns it.
4. server waits for `R`, **BLS-verifies** `B_R`, derives `{valence, imageIndex}` via `derivePresentimentTarget` (`valence = SHA256(B_R ‖ uint32(trialIndex))[0] & 1` — an exact fair coin; image index from a disjoint digest slice mod the pool size), selects the committed image, scores `hit = predictedValence == valence`, and reveals the actual image.

The **target source is the future drand round only** — fully reproducible by anyone, no trust in the server's entropy. Trials (choice, round, `B_R`, valence, image path + sha256, hit, signature) fold into a per-session Merkle root; the trial list is the content-addressed raw blob. Two-way comms is sound because the image is bound to a round nobody can predict at choice time — there is no channel to game (contrast micro-PK's one-way isolation). Every trial is re-verifiable offline (`analyze.py`) and **in-browser** (`/verify`): both re-derive each `{valence, image}` from `B_R`, confirm the shown image against the committed manifest, **fetch and re-hash the actual pixels**, check each signature and `R > R0`, and reproduce the Merkle root — the chain runs beacon → committed image hash → real pixels → valence → hit. The §7.4 **choice-timing residual** (a server backdating when it received a choice) is now **closed by live witnesses (D16)**: before waiting for `R`, an independent witness co-signs the choice commit while `R` is still in the future (`witnessRound < R`, refusing otherwise), and both `analyze.py` and `/verify` re-check that co-signature and its ordering. The operator UI masks the synchronous co-sign with a brief "sensing" animation.

### 7.6 Implementation status (Phase 1)
Built and verified end-to-end (TypeScript server + independent Python re-verification):
- Operator **Ed25519 signing** of the pre-commitment before the `session.open` is logged (D6).
- Live **drand quicknet** beacon, **BLS-verified in-process** against the hardcoded group key, bound into every session (freshness / anti-precomputation).
- One-way generation with a **streaming Merkle commitment**.
- **Raw stream persisted**, content-addressed by SHA-256, re-verified against *both* the flat hash and the Merkle root.
- **Hash-chained** append-only ledger; integrity re-derived in Python.
- **Automated external anchoring** (`npm run anchor`): an OpenTimestamps `.ots` proof of the ledger head, plus a publishable receipt.

Residual hardening — completed in Phase 2:
- **In-process BLS verification** of the beacon: the server now binds drand **quicknet** (unchained) and verifies each pulse's BLS signature against the hardcoded group public key (the trust anchor) before binding it, so it never trusts the drand endpoint for authenticity. (Switched from the older chained mainnet — see the D2 note.)
- **Ed25519 + pre-commitment verification inside `analyze.py`**: recomputes each pre-commitment and anchor with the standard library, and verifies the operator's Ed25519 signature when the optional `cryptography` package is present — the same checks the browser `/verify` performs.
- **Subresource-integrity** on the emitted bundle: a post-build step pins every bundled asset by sha384, so the browser rejects a tampered or swapped script/style. With the npm-bundled deps, the esm.sh CDN gap is fully closed.
- **Automated external anchoring**: `npm run anchor` submits the ledger head to OpenTimestamps and writes a standard detached `.ots` proof to upgrade/verify later (Bitcoin-anchored, no account, no cost).

Phase 3 — DONE:
- **Live witnesses (D16)** close the parallel-runs (micro-PK) and choice-timing (precognition) residuals (§7.4). An independent `packages/witness` node co-signs the open, every checkpoint, every forced choice, and the seal in real time — binding a self-verified drand round + an RFC 3161 TSA on its own append-only feed — re-verified offline (`analyze.py`) and in-browser (`/verify`). M-of-N capable, deployed at N=1.

Remaining (Phase 3+):
- **Witness federation** (P2P gossip between independent peer nodes; the data model is already M-of-N) and **full in-code RFC 3161 token validation** (today delegated to `openssl ts -verify`, as the OTS proofs are to `ots verify`).

---

## 8. Architecture & Phase 1 skeleton

> Design sketch — illustrative types and layout, **not final code**. Captured here so the structure is reviewable before scaffolding.

### 8.1 The trust-path principle (why the backend language is scientifically neutral)
A reviewer's trust divides cleanly into two paths:
- **Integrity path** (cryptographic): capture raw bits, commit, sign, hash-chain, log. It is verified by *re-computation* from published artifacts (§7) — **language-independent**. SHA-256 / Ed25519 / Merkle behave identically everywhere; an auditor re-checks them and never trusts our implementation.
- **Statistical path** (inference): every confirmatory number is produced by the **open, deterministic Python pipeline** (`analysis/`) run over the *published raw data* — never by the live server. The on-screen "sigma" is **display-only**.

Because the backend sits only in the integrity path (which is cryptographically self-verifying) and never in the statistical path, **the choice of backend language carries no scientific risk.** The one place a systems language genuinely helps — direct, auditable hardware-entropy access — is isolated into a tiny Rust sidecar.

### 8.2 Stack (D8)
- **TypeScript / Node** — server (HTTP + one-way WebSocket, session state machine, generation loop, persistence) and **client** (three.js feedback).
- **Rust** — a minimal **entropy-provider sidecar** (a few hundred lines) whose only job is to emit *raw, unconditioned* bytes from a selected source (`os` | `rdseed` | `usb-trng`) with health/metadata. Small enough to audit in one sitting; clean `RDSEED` access today, USB-TRNG later.
- **Python** — the separate, versioned **analysis pipeline** (numpy/scipy), the lingua franca reviewers expect.
- **Primitives:** SHA-256, Ed25519, a domain-separated Merkle tree (streaming output commitment), **RFC 8785 JCS** for canonical JSON so hashes reproduce byte-for-byte across all three languages.

### 8.3 Repository layout (monorepo)
```
psimeter/
  docs/                 spec, protocol, pre-registration
  schema/               shared JSON Schemas — the cross-language source of truth
  packages/
    core/               TS, pure & I/O-free: commitments, Merkle, ledger chaining,
                        canonicalization, scoring-for-display. Exhaustively unit-tested.
    server/             TS: HTTP + WebSocket, session orchestration, generation loop, storage
    witness/            TS: independent live-witness node (D16) — co-signs checkpoints/choices
                        with a self-verified drand round + RFC 3161 TSA, on its own append-only feed
    entropy-provider/   Rust: raw-bytes sidecar (os | rdseed | usb-trng) + metadata/health
    client/             TS + three.js: operator UI (anchor, timer, live visual, anomaly cue)
  analysis/             Python: deterministic stats over published raw data + ledger
  ledger/               dev data: append-only entries + content-addressed raw blobs
```
`core` is deliberately pure and I/O-free so the correctness-critical logic is trivial to audit and test in isolation.

### 8.4 `EntropySource` interface (sketch)
```ts
type EntropyKind = 'os' | 'cpu-rdseed' | 'usb-trng' | 'qrng';

interface EntropyMetadata {
  deviceId?: string;                  // serial / adapter id
  firmware?: string;                  // device firmware/version
  driver?: string;                    // driver/lib version
  sampling: Record<string, unknown>;  // exact, frozen sampling parameters (D10)
}

/** Raw, UNCONDITIONED bits. Implementations MUST NOT whiten/condition (D10). */
interface EntropySource {
  readonly id: string;                // 'os-csprng' | 'rdseed' | 'onerng-...' ...
  readonly kind: EntropyKind;
  readonly confirmatory: boolean;     // false for 'os' (non-confirmatory plumbing)
  readonly metadata: EntropyMetadata;
  read(nBytes: number): Promise<Uint8Array>;   // blocks until fulfilled or throws
  health(): Promise<{ ok: boolean; detail?: string }>;
}
```
`OsEntropySource` is pure TS (`node:crypto`, CI only). `RdseedSource` and `UsbTrngSource` are thin adapters over the Rust sidecar. Whatever produced a session is copied verbatim into its ledger record.

### 8.5 Ledger entry format (sketch)
Every entry is immutable and hash-chained; a session is a `session.open` entry followed by a `session.seal` entry. Canonicalized with JCS before hashing.
```jsonc
{
  "seq": 12345,
  "ts": "2026-06-17T12:34:56.789Z",   // informational; the beacon is the trusted time
  "prevHash": "sha256:…",             // hash of previous entry
  "type": "session.open",             // session.open | session.seal | baseline.seal | external.anchor | witness.anchor
  "payload": { /* type-specific, below */ },
  "entryHash": "sha256:…"             // H(JCS(seq, ts, prevHash, type, payload))
}
```
`session.open` payload:
```jsonc
{
  "sessionId": "uuid",
  "experimentId": "binary-micropk-v1",
  "params": { "nBits": 180000, "trialBits": 200, "sampleRegime": "…" },
  "intention": "HIGH",                 // HIGH | LOW | BASELINE
  "operatorPubKey": "ed25519:…",
  "beacon": { "source": "drand", "round": 4567890, "value": "…" },
  "entropySource": { "id": "rdseed", "kind": "cpu-rdseed", "confirmatory": false, "metadata": { } },
  "serverNonce": "…",
  "precommit": "sha256:…",             // H(experimentId‖version‖experimentHash‖intention‖operatorPubKey‖beacon‖sessionId‖serverNonce‖prevHash)
  "anchor": "TIDE-7F2A-RIVER",         // short human encoding of precommit
  "operatorSig": "ed25519:…"           // Sign(precommit)
}
```
`session.seal` payload:
```jsonc
{
  "sessionId": "uuid",
  "openEntryHash": "sha256:…",         // binds back to the open entry
  "outputCommitment": "merkle:…",      // root over all raw samples
  "nSamples": 180000,
  "rawBlobRef": "blob/sha256-<root>.bin.zst",  // content-addressed raw stream
  "summary": { "ones": 90042, "zDisplay": 0.21 },  // DISPLAY ONLY — not authoritative
  // --- live witnesses (D16); ADDITIVE + OPTIONAL — absent ⇒ byte-identical to the pre-D16 seal ---
  "witnessed": true,
  "witness": {                         // open + seal co-signatures, and the quorum used
    "threshold": 1,
    "keys": ["ed25519:…"],
    "open":  [ { "witnessPubKey": "ed25519:…", "witnessRound": 4567890, "witnessChainHash": "…", "witnessSig": "ed25519:…", "feedSeq": 12, "feedEntryHash": "sha256:…" } ],
    "seal":  [ { "…": "…" } ]
  },
  "checkpoints": [                     // micro-PK: each live checkpoint root + its co-signatures
    { "trial": 5, "root": "sha256:…", "witness": [ { "…": "…" } ] }
  ]
  // (precognition stores each choice's `witness[]` inside its per-trial record in the raw blob)
}
```
`external.anchor` entries periodically publish the current head hash with its TSA / git / OpenTimestamps proofs. `witness.anchor` entries cross-bind the independent **witness feed** head (+ its TSA/OTS refs) into the main chain (D16); the witness feed itself is a sibling hash-chained log of `witness.attest` entries, verified by the same machinery.

### 8.6 Timing note (addresses a common objection)
Statistical validity depends only on collecting the pre-declared **N independent samples**, not on wall-clock regularity. We therefore **decouple** the fixed, documented sampling regime from the visual frame rate: the three.js view is a *downsampled* projection of the stream. Event-loop jitter or GC pauses can affect the *animation*, never the binomial count — so they pose no validity risk.

---

## 9. Phasing

- **Phase 0 — DONE:** Methodology locked (D1–D13) and the provenance flow specified (§7).
- **Phase 1 — DONE:** Local instrument — binary micro-PK with the full provenance spine (operator signing → drand beacon → one-way generation → streaming Merkle → content-addressed raw-blob persistence → hash-chained ledger → external-anchor receipts), RDSEED real-entropy self-testing, and independent Python verification.
- **Phase 2 (next):** The **public website** (see §10) + the **two-color precognition** experiment; per-operator identity & history; the leaderboard/aggregate view done correctly (D4).
- **Phase 3 (in progress):** **Live witnesses — DONE (D16):** independent real-time co-signing of the open, checkpoints, choices, and seal closes the §7.4 parallel-runs & choice-timing residuals (`packages/witness`, re-verified in `analyze.py` + `/verify`). Remaining: hardware TRNG/QRNG integration + characterization; witness federation (P2P peers); cloud deployment (likely AWS); pre-registration finalized.
- **Phase 4:** Confirmatory collection period → public dataset release → paper.

---

## 10. Public website (Phase 2)

PsiMeter has two equally important faces: the scientific instrument (above) and a **public, gamified website** that strangers worldwide will actually use. Engagement is the data-collection engine (sample size powers H1/H2) — but **the gamification must never alter the protocol or misrepresent what a result means.**

### Required sections
1. **About / how it works.** A friendly, skeptic-accessible explanation of the purpose, the method, and — crucially — *how the cryptographic auditability works* (why you don't have to trust us). A readable on-ramp, not the paper.
2. **Experiments browser.** Browse available experiments with summary stats; a per-experiment detail page (protocol, parameters, aggregate history) with the option to run a session; and **each visitor's own run history, tied to their browser-held Ed25519 operator key (D6)** — pseudonymous, no PII.
3. **Psi-score leaderboard.** Ranks **people, not sessions**: each operator's **psi score** (D15) — an anytime-valid test-martingale e-value measuring consistent, declared-direction deviation across their own sessions (H1), shown as points (decibans), odds-against-chance, and a sigma-equivalent. Honest by construction: a "candidate" flag means *flagged for confirmatory replication*, never proof (D4); the expected-by-chance candidate count is shown alongside. Crossing the threshold unlocks an opt-in contact form (D15). The old "most extreme sessions" list is retired (those anomalies are guaranteed by chance and prove nothing).
4. **Gamified experiment UI.** Pretty and engaging enough that people *want* to play. The **anchor must be shown large and central** — in ESP protocols it is the mental focal point the operator concentrates on — alongside the live feedback. Frame it as a game to "beat," which underneath is faithful participation in the real experiment.

### Constraints carried from the science
One-way isolation (pillar 5) is unchanged. The anchor is the signed pre-commitment fingerprint (§7.2). Per-user history and any "skill"/leaderboard framing must respect **D4** (leaderboard ≠ proof), **D12** (experimenter/operator self-deception guards), and **D13** (a single session is not evidence).

### Phase 2 build status
- **Client framework `DECIDED`:** **TypeScript + Vite, no UI framework** (hand-rolled DOM components + a History-API router), chosen for the smallest auditable dependency surface and a pinned, bundled build. Dependencies (`three`, `@noble/ed25519`) are now bundled from npm instead of the esm.sh CDN, retiring that supply-chain risk from §7.6. The Node server serves the built assets with SPA fallback; `npm run dev:client` gives a hot-reload dev server that proxies `/api` to the instrument.
- **Built & verified** (branch `phase2-public-site`): the **gamified experiment UI** (`/run`) — anchor large and central as the concentration target, live three.js cumulative-deviation feedback, countdown/HUD, and an honest seal summary that states a single session is not evidence (D4/D13); the **About / how-it-works** explainer (`/about`); the **experiments browser**, the **psi-score leaderboard** (D15 — operators ranked by an anytime-valid test-martingale e-value, with an honest expected-by-chance candidate count and a candidate-not-proof frame), and the per-operator **history** page (now showing the visitor's own psi score, ladder, and — at the candidate threshold — an **opt-in, operator-signed contact form** stored privately off-ledger), all driven by server **read APIs** over the ledger (`GET /api/experiments`, `/api/stats`, `/api/leaderboard`, `/api/sessions`, `/api/sessions/:id`; `POST /api/contact`); and **in-browser verification** (`/verify`) that recomputes the pre-commitment + anchor and checks the operator's Ed25519 signature entirely client-side. The last is made possible by refactoring `core`'s hashing from `node:crypto` to pure-JS **`@noble/hashes`** — byte-identical output, so cross-language parity with `analyze.py` is preserved (the core unit tests, incl. the SHA-256 vector, still pass).
- **Multi-experiment platform `BUILT`:** the stack was generalized to an **experiment-kind registry** (D14) with micro-PK behaviour and every committed hash unchanged (frozen golden-vector tests guard against drift), and the **presentiment / forced-choice precognition** experiment (§7.5) was added end-to-end. Each trial reveals a **real affective image** (calm vs aversive) selected by a future beacon round from a **content-hash-pinned CC0 corpus** (`stimuli/`, built by `scripts/build-stimuli.mjs`), behind a content-warning consent gate; the client shows the actual image full-screen and scores per-operator hit-rate (H1). Full re-verification both in `analyze.py` and **in-browser** (`/verify`) now runs the whole chain beacon → committed image hash → **re-hashed pixels** → valence → hit. `/run` routes by `?experiment=<id>&v=<n>`; experiments/leaderboard/history are choice-vocabulary-agnostic.
- **Still open:** **live witnesses** (§7.4) to close the residual parallel-runs / choice-timing attack — Phase 3. A richer presentiment stimulus corpus (images/sound) and per-experiment confirmatory leaderboards are future polish. (SRI, in-process BLS verification of the drand quicknet beacon, Ed25519 + pre-commitment verification in `analyze.py`, and automated OpenTimestamps anchoring landed earlier in Phase 2.)

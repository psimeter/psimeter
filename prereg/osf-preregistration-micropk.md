# OSF Pre-registration — Binary micro-PK (RNG influence)

> **This is the confirmatory scientific commitment for the binary micro-PK experiment.**
> It is deliberately *separate* from the protocol specification. The spec
> ([`spec/psimeter-protocol.md`](../spec/psimeter-protocol.md)) defines the **cryptographic
> methodology** (how a result is made auditable); this document defines the **scientific claim**
> (what is predicted, the fixed sample size, the primary outcome, the analysis, and the decision
> rule) so that it cannot be changed after the data exist — pre-empting HARKing, p-hacking, and
> optional stopping. **Where the two overlap, this document cites the spec's `[PSI-*]` requirement
> IDs and the `D#` decision-log items rather than restating them, and on any conflict the spec
> wins.**

| | |
|---|---|
| **Title** | Does declared intention bias a true random bit source? A pre-registered, fixed-N, cryptographically auditable confirmatory test (binary micro-PK) |
| **Authors** | Adler Oliveira — PsiMeter instrument & protocol author. *(See §10: the author is **not** enrolled as a confirmatory subject. `[DECISION NEEDED: named independent lead analyst / co-author]` — see §10.)* |
| **Draft date** | 2026-06-21 |
| **Registration status** | **DRAFT — not yet registered on OSF.** Registration is a manual external step; see the checklist in [`prereg/README.md`](README.md). |
| **Experiment** | `binary-micropk` **v1** (`micro-pk-binary`) — [`experiments/binary-micropk-v1.json`](../experiments/binary-micropk-v1.json) |
| **`experimentHash`** | `sha256:6b22640ec4495d19d0c4aeb6f81804a076a9201f5cb4749f88fafaa53fd45a08` — `H(PCJ(definition))` per [PSI-EXP-3]; pins the exact parameters. |
| **Protocol bound** | PsiMeter Verifiable-Experiment Protocol — **`[DECISION NEEDED: released version]`** (currently `0.1.0-draft`; a confirmatory registration MUST bind a *released*, immutable version — see [`prereg/README.md`](README.md) checklist). |
| **License** | CC BY 4.0 (matches the spec text). |

---

## 1. Study information

### 1.1 The two-phase frame (read this first)

PsiMeter runs in two phases (RATIONALE §5, "Two-phase architecture"); this registration is the
**confirmatory** one:

- **Exploratory / screening (the open public platform).** Anyone, worldwide, runs unlimited
  sessions. The per-operator **psi score** — an anytime-valid test-martingale e-value
  ([PSI-EVALUE-1…4], D15) — and its leaderboard live here. A **"Candidate"** flag
  (`W ≥ 1000` and `≥ 5` scored sessions, [PSI-EVALUE-4]) means **"flagged for a separate,
  pre-registered, fixed-N confirmatory replication" — never proof of psi** (D4: the leaderboard is
  not evidence; D13: a single session has ~no power). Everything on the open platform is
  **exploratory** and is *never* cited as confirmation.
- **Confirmatory (this document).** Frozen hypotheses, a **fixed, pre-declared N** with **no
  optional stopping** (D4, [PSI-GEN-2]), one primary outcome, one primary test, a pre-set α, and an
  explicit accept/reject rule, registered **before** the confirmatory data are generated.

Two confirmatory arms are registered below: the **corpus-level test (H2)** in §6 is the headline,
and the **candidate-replication test (H1)** in §7 is the per-operator confirmatory arm that an
exploratory "Candidate" flag triggers.

### 1.2 Background

The paradigm is the PEAR-style REG micro-psychokinesis experiment (RATIONALE §1, lineage): can a
human observer, by intention alone, bias the proportion of 1-bits emitted by a **true, physical**
random source (D1, D10)? The canonical reported per-bit effect is small —
≈ 1–2 × 10⁻⁴ in the bit probability (RATIONALE D13, "honest power note") — so **no single session
has meaningful power** (D13); all inference lives in aggregation across many pre-committed sessions.

### 1.3 Hypotheses (directional)

Both project hypotheses (RATIONALE §5) are stated; this experiment's **primary** confirmatory
outcome is the H2 corpus contrast (§6), with H1 as the per-operator confirmatory arm (§7).

- **H2 (primary here) — excess directional corpus deviation.** Across the confirmatory corpus, the
  **HIGH−LOW oriented** aggregate deviation of the true-RNG bit proportion is **greater than zero**
  (one-sided): intention in the declared direction shifts the source. The directional contrast
  (HIGH → more 1s, LOW → fewer) is used precisely because it **cancels any static source bias**
  ([PSI-PK-1], D5/D10), so a non-zero result cannot be an artifact of a biased generator.
  - **H2₀ (null):** the oriented aggregate deviation is ≤ 0 (the calibrated baseline source, §6.3).
  - **H2₁ (alternative, directional):** the oriented aggregate deviation is > 0.
- **H1 (secondary here) — individual consistency.** Specific operators produce above-chance,
  **declared-direction** deviation **consistently across their own sessions** (not one lucky run).
  Tested as the per-operator within-subject HIGH−LOW effect plus split-half/test–retest reliability
  (§7), only via **replication of exploratory-screened candidates**.

A confirmatory result for H2₁ would be evidence that the effect exists at the corpus level; a
confirmatory result for H1 (a candidate who replicates) would be evidence that a *specific person*
carries it. Neither is claimed from the exploratory platform.

---

## 2. Design plan

- **Study type.** Observational/experimental online data collection through the PsiMeter
  instrument (`packages/server` + `packages/core`), with all artifacts written to the append-only,
  hash-chained ledger (spec §9).
- **Conditions (the manipulated IV).** The operator's **declared intention**, committed *before any
  randomness exists* ([PSI-PRECOMMIT-2], §7): **`HIGH`**, **`LOW`**, or **`BASELINE`**
  ([PSI-PK-1]). Assignment is `volitional` (the published v1 parameter; the operator chooses),
  which is itself a hash-bound parameter and therefore part of `experimentHash`.
- **Blinding & isolation.** During generation the source reads **nothing** from the client —
  one-way isolation is *architectural*, not policy ([PSI-GEN-1], §3.3). The operator cannot see
  raw bits; only the **anchor** (the pre-commitment fingerprint, [PSI-ANCHOR-1]) and a downsampled
  visual. The generator is blind to intention in the sense that the same code path produces HIGH,
  LOW, and BASELINE streams.
- **Pre-commitment (per session).** Intention, parameters (`experimentHash`), operator identity,
  the bound public-beacon pulse, and the ledger head are frozen into one hash and signed by the
  operator **before** the random data exist ([PSI-PRECOMMIT-1…4], §7; D2/D3). This is what makes
  every session pre-registered at the per-session level.
- **Freshness.** Each session binds a **drand quicknet** beacon pulse, BLS-verified in-process
  ([PSI-BEACON-1…3], §8), proving the record did not pre-exist a known public moment.
- **Independent witnesses.** Confirmatory sessions are **co-signed in real time** by an independent
  witness over the open, every checkpoint root, and the seal ([PSI-WITNESS-3], §13, D16), closing
  the "parallel-runs" attack (spec §15). See §8 for the witnessing requirement and its honest N=1
  limitation.

---

## 3. Variables

### 3.1 Manipulated (independent) variable

- **Declared intention** ∈ {`HIGH`, `LOW`, `BASELINE`}, committed per session ([PSI-PK-1], §7).

### 3.2 Measured (dependent) variables — **integer counts only**

Per the canonicalization and ledger rules, **only integers are committed**; no real-valued
statistic (no z-score) is ever stored ([PSI-CANON-3], [PSI-LEDGER-5]). The authoritative DV per
session is therefore:

- **`ones`** — the count of 1-bits in the session, an integer, out of
- **`nSamples`** = `bitsPerSession` = **180000** bits (a trial = `trialBits` = 200 raw bits;
  `trialsPerSession` = 900) ([PSI-PK-2], [PSI-GEN-6]).

All per-session and aggregate statistics (the display z, the Stouffer Z, the psi-score wealth) are
**derived from these integer counts at analysis time** ([PSI-SCORE-1], [PSI-EVALUE-2], §3.2 of the
spec) — never read from the server, never stored on the ledger.

### 3.3 Derived statistics (computed in analysis, not stored)

- Per-session display z: `z = (ones − n/2) / sqrt(n/4)`, `n = nSamples` ([PSI-SCORE-1]).
- **Oriented** per-session score `d_i = +z_i` for `HIGH`, `−z_i` for `LOW`; `BASELINE` excluded
  from scoring ([PSI-PK-1], [PSI-EVALUE-1]).

---

## 4. Published parameters (hash-bound — do not re-state, cite)

From [`experiments/binary-micropk-v1.json`](../experiments/binary-micropk-v1.json), pinned by
`experimentHash = sha256:6b22640e…` ([PSI-EXP-3]). Any change bumps the version and the hash and
**partitions the corpus** ([PSI-EXP-4]); sessions under a different hash are **never pooled**.

| Parameter | Value |
|---|---|
| `trialBits` | 200 (a trial is Binomial(200, ½): mean 100, SD √50 ≈ 7.071) |
| `bitRatePerSec` | 1000 |
| `sessionSeconds` | 180 |
| `trialsPerSession` | 900 |
| `bitsPerSession` | **180000** |
| `checkpointEveryTrials` | 5 |
| `intentionAssignment` | `volitional` |
| `conditioning` | `none` (raw/unconditioned, D10, [PSI-GEN-3]) |

---

## 5. Sampling plan & stopping rule

### 5.1 Existing data

**No confirmatory data have been collected.** Confirmatory collection begins **only after** this
registration is frozen and timestamped on OSF (and the protocol version + analysis script are
frozen — see [`prereg/README.md`](README.md)). Exploratory/pilot sessions already on the open
platform are **excluded** from the confirmatory corpus (§9).

### 5.2 Sample size (fixed N — power analysis)

**Decision recorded by the owner:** target effect = **optimistic** end of the PEAR range
(ε ≈ 2 × 10⁻⁴ per bit); **one-sided α = 0.005** (the Benjamin et al. 2018 "redefine statistical
significance" standard, appropriate for an extraordinary claim); **power = 0.90**.

The per-session directional effect implied by a per-bit shift ε is
`δ = E[d_i] = 2·ε·sqrt(nSamples) = 2 × (2×10⁻⁴) × sqrt(180000) ≈ 0.170` (in z units per session).
For the oriented Stouffer statistic `Z* = (Σ d_i) / (σ̂₀ · sqrt(k))` (§6.1), under H1₁
`E[Z*] = sqrt(k) · δ / σ̂₀`. With σ̂₀ ≈ 1 (the calibrated null SD, §6.3), the required
non-centrality is `z₀.₉₉₅ + z₀.₉₀ = 2.5758 + 1.2816 = 3.8574`, giving

> **k = ⌈(3.8574 / 0.170)²⌉ = 517 → rounded up to N = 520 scored sessions**, split
> **balanced 260 `HIGH` + 260 `LOW`** (balance is required so static bias cancels, §6.1).
> Achieved power at N = 520, ε = 2×10⁻⁴: ≈ **0.90**.

**Calibration corpus.** In addition, **N_baseline = 260 `BASELINE` sessions** are collected through
the identical pipeline (D5) to estimate the empirical null mean/SD (σ̂₀) and to run the continuous
randomness test suites (§6.3). `BASELINE` sessions are calibration only and are **excluded** from
the scored contrast ([PSI-PK-1]).

**Reference points (not the chosen row).** At the same α = 0.005 / 90% power, smaller assumed
effects need far more sessions — PEAR-canonical ε ≈ 1.5×10⁻⁴ (δ ≈ 0.13) → ≈ 890; conservative
ε ≈ 1×10⁻⁴ (δ ≈ 0.085) → ≈ 2060. This is the basis of the **honest underpowered caveat** in §11.

### 5.3 Stopping rule — **none (fixed N)**

Collection stops at **exactly** N = 520 scored sessions (260/260) + 260 BASELINE, in the order they
seal on the ledger. **There is no optional stopping and no interim peeking that affects the decision**
(D4, [PSI-GEN-2] at the session level; pre-declared corpus N here). The confirmatory window is the
contiguous block of qualifying sessions (§9) from the first seal after registration until N is
reached; the primary test (§6) is computed **once**, on the complete block.

> *Operator-level optional stopping* (players stopping the psi score at a favorable peak) is a
> property of the **exploratory** platform only, and is handled there by the **anytime-valid**
> e-value ([PSI-EVALUE-2], Ville's inequality). It does **not** apply to this fixed-N confirmatory
> corpus, and candidate replications (§7) likewise use a fixed N_rep set before their data exist.

---

## 6. Analysis plan — primary confirmatory test (H2)

### 6.1 Primary statistic and model

Let the confirmatory corpus be the `k = 520` scored `HIGH`/`LOW` sessions (§5, §9). For each,
compute the per-session display z and orient it ([PSI-SCORE-1], [PSI-EVALUE-1]):
`d_i = +z_i` (`HIGH`), `d_i = −z_i` (`LOW`). The **primary statistic** is the oriented Stouffer
combination, standardized by the calibrated null SD:

```
Z*  =  ( Σ_{i=1}^{k} d_i )  /  ( σ̂₀ · sqrt(k) )
```

where `σ̂₀` is the empirical SD of the per-session z over the BASELINE corpus (§6.3; `σ̂₀ ≈ 1` for
an ideal source). Under H2₀, `Z* ~ N(0, 1)`. Because `HIGH` and `LOW` are balanced and oppositely
oriented, **any static source bias cancels in `Σ d_i`** ([PSI-PK-1], D5/D10) — the test is immune to
a constant generator bias by construction.

### 6.2 Inference criterion / decision rule

> **Reject H2₀ in favor of the directional H2₁ iff `Z* ≥ 2.5758`** (one-sided, α = 0.005). This is
> the single, pre-registered primary decision. Equivalently, reject iff the one-sided p-value
> `1 − Φ(Z*) ≤ 0.005`.

The decision is made **once**, on the complete N = 520 block. The point estimate (mean oriented
per-session z and its two-sided 99% CI) and the implied per-bit ε are reported alongside,
regardless of the decision.

### 6.3 The calibrated null (not an assumed N(0,1))

The null is **empirical**, never merely theoretical (D5):

1. From the 260 BASELINE sessions, estimate the null mean `μ̂₀` and SD `σ̂₀` of the per-session z.
2. **Source-validity gate (data quality, pre-registered).** If the BASELINE corpus fails the
   continuous randomness suites (NIST SP 800-22 STS / Dieharder / TestU01, D5) at their standard
   thresholds, or shows time-drift in `μ̂₀` beyond a pre-set tolerance, the confirmatory corpus is
   **invalidated and re-collected** — a baseline anomaly is a *source* problem, never interpreted as
   psi.
3. The HIGH−LOW contrast (§6.1) is the headline because it is robust to any `μ̂₀ ≠ 0`; `σ̂₀`
   corrects for variance inflation.

### 6.4 Robustness analyses (pre-registered, secondary)

To prevent a single heavy or fraudulent operator from manufacturing the result (the "PEAR Operator
10" risk, RATIONALE §5/H2):

- **Leave-one-operator-out (LOO):** recompute `Z*` dropping each operator in turn; the H2 decision
  is reported as robust only if it does not hinge on any single operator.
- **Per-operator cap:** recompute `Z*` capping each operator's contribution at a pre-registered
  maximum number of sessions `C` **`[DECISION NEEDED: cap C — recommend C = 20 (≈ N/26)]`**.
- **Owner exclusion (D12):** the author's operator key, if present at all, is excluded a priori
  (§10).

These are **secondary**; the primary decision (§6.2) stands on the full corpus, but a result that
fails LOO is reported as *not* a general corpus effect (§11).

---

## 7. Analysis plan — candidate-replication test (H1, secondary confirmatory arm)

This arm converts an **exploratory** "Candidate" flag into a confirmatory claim about a *specific
person*; the screening itself is never confirmatory (D4, D15).

- **Trigger.** An operator is flagged **Candidate** by the exploratory psi score: `W ≥ 1000` **and**
  `≥ 5` scored sessions ([PSI-EVALUE-4]). The leaderboard shows the expected-by-chance candidate
  count, so a flag is explicitly *a screening signal, not proof*.
- **Replication (fixed N_rep, no optional stopping).** The candidate completes a pre-registered
  block of **N_rep** balanced `HIGH`/`LOW` sessions under the same hash-bound `binary-micropk` v1.
  `N_rep` is fixed **before the first replication session** by the frozen power rule
  (90% power, α = 0.005) using the **conservative lower 50%-CI bound** of the candidate's
  *screened* directional per-session effect `δ̂` — i.e. `N_rep = ⌈(3.8574 / δ̂_lo)²⌉`, capped at a
  pre-registered maximum **`[DECISION NEEDED: N_rep cap — recommend 1000 sessions]`**. `N_rep` is
  written into the ledger (a `session.open` precedes any data), so it cannot be adjusted post hoc.
- **Primary test (per candidate).** The within-operator oriented Stouffer `Z*` over the
  **replication block only** (screening sessions excluded). Reject that candidate's H1₀ iff `Z*`
  clears the **Holm–Bonferroni-adjusted** one-sided α = 0.005 across the family of all candidate
  replications conducted in the confirmatory window (family-wise error control; the number of
  candidates is not known in advance, so the *method* — Holm–Bonferroni — is pre-registered, not a
  fixed count).
- **Consistency check (secondary).** Split-half / test–retest reliability within the replication
  block: does the candidate's effect in the first half predict the second half? A stable ability
  predicts a positive correlation — the distinctive H1 signature, hard to fake or to obtain by
  chance (RATIONALE §5/H1).

---

## 8. Data-quality gate: which sessions count

A session enters the confirmatory corpus **iff** every one of these holds (each is mechanically
checkable; see §12):

1. **Sealed and complete.** A `session.open` followed by a `session.seal` with the full
   `nSamples = 180000` ([PSI-GEN-2]); partial/abandoned runs do not count.
2. **Confirmatory beacon.** Bound to a **drand quicknet** pulse that **BLS-verifies** ([PSI-BEACON-2/3]);
   dev-beacon sessions are non-confirmatory and excluded ([PSI-BEACON-4]).
3. **Confirmatory entropy source.** A **physical** source (RDSEED pilot / open-hardware TRNG / QRNG,
   D1/D11); `os` entropy is non-confirmatory plumbing and is excluded ([PSI-GEN-3], D1). The exact
   recorded `entropySource` is reported.
4. **Witnessed.** Co-signed by ≥ M of the auditor's trusted witness set ([PSI-WITNESS-5], §13, D16),
   with the seal's `outputCommitment` continuing the witnessed checkpoint prefixes ([PSI-WITNESS-3]).
   **Un-witnessed sessions are never pooled with witnessed confirmatory data** (spec §15, D16).
   - *Honest limitation (the frontier).* The reference deployment is **N = 1** witness; a single
     owner-run witness is not independence on its own. At N = 1 the un-forgeable time root is the
     **RFC 3161 TSA** (+ OpenTimestamps/Bitcoin long-term), so backdating is bounded to TSA
     granularity even then (spec §15, [PSI-WITNESS-6]). The registration's credibility on this axis
     **scales with independent peers running witnesses**; the project openly invites them.
5. **Verifies.** Passes every applicable check in the verification procedure ([PSI-VERIFY-1…8],
   §14): chain integrity, pre-commitment + anchor + operator signature, freshness, output
   commitment, and witness/anchor cross-checks. **A session that fails any check is excluded — and
   its exclusion is itself public and reproducible** (it fails `analyze.py`).

`experimentHash` mismatch (a different parameter version) → excluded and never pooled ([PSI-EXP-4]).

---

## 9. Exclusion, missing-data, and confound handling

### 9.1 Exclusions (pre-registered)

- All exploratory / pilot / pre-registration sessions (collected before the frozen registration).
- Any session failing the §8 gate (unsealed, dev-beacon, `os` entropy, un-witnessed once witnessing
  is required, or failing verification) — exclusion is mechanical, not a judgment call.
- Sessions under any `experimentHash` other than `sha256:6b22640e…` ([PSI-EXP-4]).
- The author's operator sessions, if any (§10, D12).

### 9.2 Missing data

A session is atomic (open + seal). There is no within-session imputation: an incomplete run is
excluded entirely, not partially counted ([PSI-GEN-2]). Because N is the count of *qualifying sealed*
sessions, collection simply continues until exactly N qualifying sessions exist.

### 9.3 Confounds and how each is neutralized

| Confound | Neutralization |
|---|---|
| **Static source bias** | Balanced, oriented **HIGH−LOW** contrast cancels it; empirical baseline calibration (D5, D10, [PSI-PK-1]). |
| **Optional stopping** | Fixed session N ([PSI-GEN-2]) and fixed corpus N (§5.3); the only anytime-valid object (the psi score) is exploratory-only ([PSI-EVALUE-2]). |
| **Multiple comparisons** | One primary test (§6.2); the leaderboard is not evidence (D4); candidate replications use Holm–Bonferroni (§7). |
| **Pre-computation / backdating** | Beacon freshness ([PSI-BEACON-1]); live witnesses + TSA time root (§13, D16). |
| **Cherry-picked streams (parallel runs)** | Witnessed checkpoints + seal-must-continue-prefix ([PSI-WITNESS-3], spec §15). |
| **Untrusted experimenter** | Handled by the **integrity path** (re-computation from public artifacts, §3.2/§14), not by trust — see §12. |
| **Experimenter-as-subject (D12)** | Author does not enrol as a confirmatory subject (§10); LOO + per-operator cap (§6.4) defend against *any* heavy user. |
| **Sybil / multi-key** | A screening concern only; answered by the confirmatory phase + optional stronger identity for flagged candidates (D6/D9, spec §15). |

---

## 10. The experimenter-as-subject question (D12) and the analyst role

**Owner's decision (recorded).** The project author **will not enrol as a confirmatory test
subject.** This is the **strongest** form of the D12 safeguard: total separation of the experimenter
from the confirmatory subject pool, chosen specifically to keep the project neutral and to avoid
inviting skepticism. If the author uses the public platform at all, it is **exploratory-firehose
only**, and that operator key is **pre-declared and excluded from every confirmatory analysis**
(§9.1).

**Recommended analyst posture (the author deferred this choice).** The recommendation leans on a
structural fact: the confirmatory result does **not** depend on trusting whoever runs the analysis,
because the analysis is a **deterministic, open script over public data** (the integrity/statistical
path separation, spec §3.2; [PSI-VERIFY-9]). Concretely:

1. **Freeze and hash-anchor the analysis pipeline before collection.** Pin the exact
   `analysis/analyze.py` (record its git commit SHA + a SHA-256 of the script) **and** this decision
   rule, and anchor them into the ledger alongside the OSF DOI (§13) — so the analysis has **no
   post-hoc degrees of freedom** (mirroring the experiment-definition discipline D13 and the pinning
   of the psi grid / witness set, [PSI-EVALUE], [PSI-WITNESS-5]). After freezing, the confirmatory
   number is simply *whatever the pre-registered script outputs over the public ledger* — and anyone
   can re-run it ([PSI-VERIFY-9], §12).
2. **Openly invite an independent lead analyst / co-signer.** A named independent party should
   (a) co-sign the freeze, (b) be the nominal lead analyst, and (c) co-hold the ledger anchors
   (D12's "independent party co-holds/co-signs"). Recruiting one **strengthens** credibility but is
   **not a blocker**, because step 1 already makes the result mechanically reproducible by anyone.
   `[DECISION NEEDED: name the independent lead analyst, or register with the open invitation
   standing and add them by amendment before confirmatory collection.]`

This is the **honest-frontier** posture, deliberately consistent with the witness story (N = 1 today,
strengthening as independent peers join, spec §15): the headline does **not** rest on trusting the
experimenter even at N = 1, because the chain is self-verifying and the script is frozen and public.

---

## 11. What would falsify this — and the honest power caveat

- **Confirmation of H2₁:** `Z* ≥ 2.5758` at N = 520 (§6.2). Reported with the LOO/cap robustness
  (§6.4): a result that **fails LOO** is reported as *carried by one operator*, **not** a general
  corpus effect — which falsifies H2 *as a population claim* even if an individual effect remains for
  the H1 arm.
- **A confirmed candidate (H1):** a flagged operator whose **replication** clears the
  Holm–Bonferroni threshold (§7) — evidence a *specific person* carries the effect. A flagged
  candidate who **fails** replication has that H1 claim **disconfirmed** (the expected outcome if the
  flag was chance).
- **The honest underpowered caveat (a feature, not a footnote — D13).** N = 520 is powered for the
  **optimistic** effect (ε = 2×10⁻⁴). If the true effect is smaller, a **null is inconclusive, not
  disconfirming**:
  - at the PEAR-canonical ε = 1.5×10⁻⁴, power at N = 520 ≈ **0.63**;
  - at the conservative ε = 1×10⁻⁴, power at N = 520 ≈ **0.26**.
  So a null result here **disconfirms an effect of the assumed size or larger**, and does **not**
  rule out a smaller effect. To make a null *disconfirm the canonical effect* (the "disprove at
  scale" goal), pre-register an extension to the conservative N (≈ 2060 sessions) and/or a
  **TOST equivalence test** against a smallest-effect-of-interest
  **`[DECISION NEEDED: register an equivalence bound / extension-to-conservative-N, or accept that a
  null at N=520 is only "no optimistic-size effect"]`**.
- **Source-validity falsifier.** If the BASELINE corpus fails the randomness suites or drifts
  (§6.3), the run is invalidated as a *source* fault — explicitly **not** counted as evidence either
  way.

---

## 12. Distinctive feature — every result is independently re-verifiable

This is what sets the registration apart from a conventional pre-reg: **the confirmatory numbers can
be re-derived from public artifacts by anyone, trusting neither the server nor its code** (the
untrusted-experimenter axiom, spec §3.1).

- **Offline:** `python analysis/analyze.py ledger/<file>.jsonl` re-runs the full verification
  procedure ([PSI-VERIFY-1…9], §14) and recomputes every statistic (the per-session z and the
  oriented Stouffer `Z*`) from the integer counts — independently of the live server (Python, stdlib).
- **In-browser:** the `/verify` view performs the same checks client-side.
- **Cross-language byte-parity** is CI-enforced via the shared test vectors
  (`analyze.py --check-vectors`, spec Appendix A, design goal G6), so "the analysis script" is not a
  single trusted implementation.
- **Binding the registration to the ledger (bidirectional pre-commitment).** Consistent with the
  project's own ethos, the OSF registration and the PsiMeter ledger should mutually bind — see the
  shared procedure in [`prereg/README.md`](README.md) §"Anchor the registration into the ledger".

---

## 13. AsPredicted-style 9-question summary

1. **Have any data been collected for this study already?**
   No. Confirmatory collection starts only after this registration is frozen/timestamped on OSF and
   the protocol version + `analyze.py` are frozen. Prior exploratory/pilot sessions are excluded.
2. **What's the main hypothesis being tested?**
   That declared intention biases a true physical RNG in the declared direction: the balanced,
   oriented **HIGH−LOW** aggregate deviation of the bit proportion is **greater than zero** (H2₁,
   one-sided). Secondary: specific screened operators replicate a consistent declared-direction
   effect (H1).
3. **Describe the key dependent variable(s) and how they are measured.**
   Integer **`ones`** out of **`nSamples` = 180000** bits per session ([PSI-LEDGER-5], [PSI-PK-2]);
   no z-score is stored. The analysis derives per-session z and the oriented Stouffer `Z*`
   ([PSI-SCORE-1]).
4. **How many and which conditions?**
   Three pre-committed conditions: **HIGH**, **LOW**, **BASELINE** ([PSI-PK-1]); the scored contrast
   is HIGH vs LOW (balanced 260/260), BASELINE is calibration only.
5. **Specify exactly the analyses for the main hypothesis.**
   Oriented Stouffer `Z* = (Σ d_i)/(σ̂₀·√k)`, `d_i = +z` (HIGH) / `−z` (LOW), `σ̂₀` from the BASELINE
   corpus; **reject H2₀ iff `Z* ≥ 2.5758`** (one-sided α = 0.005). Secondary: LOO + per-operator cap;
   the candidate-replication arm (§7).
6. **Outliers and exclusions.**
   No value-based outlier removal (counts are exact). Mechanical exclusions only: unsealed,
   dev-beacon, `os`-entropy, un-witnessed (once required), wrong-`experimentHash`, or
   verification-failing sessions; and the author's sessions (D12). See §8–§9.
7. **Sample size / how N is determined.**
   **Fixed N = 520 scored sessions (260 HIGH + 260 LOW) + 260 BASELINE.** From a power analysis at
   one-sided α = 0.005, 90% power, optimistic ε = 2×10⁻⁴ (δ ≈ 0.170/session). **No optional
   stopping** (D4); the primary test is computed once on the complete block.
8. **Anything else being pre-registered?**
   The H1 candidate-replication protocol (§7, Holm–Bonferroni); the baseline source-validity gate
   (§6.3); the robustness analyses (§6.4); the honest underpowered caveat / optional equivalence
   extension (§11); and that every result is re-verifiable from public artifacts (§12).
9. **Study name / type.**
   "Binary micro-PK (RNG influence)" — a confirmatory, fixed-N, cryptographically auditable online
   experiment under the PsiMeter protocol. Type: confirmatory hypothesis test.

---

## 14. Open decisions to resolve before freezing

These are flagged inline above; collected here for the registration checklist:

- `[DECISION NEEDED]` Named **independent lead analyst / co-signer**, or register with the open
  invitation standing (§10).
- `[DECISION NEEDED]` Per-operator **cap C** for the robustness analysis (recommended C = 20) (§6.4).
- `[DECISION NEEDED]` **N_rep cap** for candidate replications (recommended 1000) (§7).
- `[DECISION NEEDED]` Whether to also register a **conservative-N extension and/or TOST equivalence
  bound** so a null can *disconfirm* the canonical effect (§11).
- `[DECISION NEEDED]` **Embargo:** default is **none** (open by default, RATIONALE design pillar 7;
  the public dataset is released for the paper). OSF permits an embargo of up to 4 years if desired.
- `[DECISION NEEDED]` The **released protocol version** to bind (not the current `0.1.0-draft`).

*See [`prereg/README.md`](README.md) for the step-by-step OSF registration + ledger-anchoring
checklist.*

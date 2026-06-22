# OSF Pre-registration — Presentiment (forced-choice precognition)

> **This is the confirmatory scientific commitment for the presentiment experiment.**
> It is deliberately *separate* from the protocol specification. The spec
> ([`spec/psimeter-protocol.md`](../spec/psimeter-protocol.md)) defines the **cryptographic
> methodology** (how a result is made auditable); this document defines the **scientific claim**
> (what is predicted, the fixed sample size, the primary outcome, the analysis, and the decision
> rule) so it cannot be changed after the data exist — pre-empting HARKing, p-hacking, and optional
> stopping. **Where the two overlap, this document cites the spec's `[PSI-*]` requirement IDs and
> the `D#` decision-log items rather than restating them, and on any conflict the spec wins.**

| | |
|---|---|
| **Title** | Can people anticipate the emotional valence of a not-yet-determined image? A pre-registered, fixed-N, cryptographically auditable confirmatory test (forced-choice presentiment) |
| **Authors** | Adler Oliveira. *(Independent lead analyst / co-signer invited — see §10; `[DECISION NEEDED]`.)* |
| **Draft date** | 2026-06-21 |
| **Registration status** | **DRAFT — not yet registered on OSF.** Registration is a manual external step; see the checklist in [`prereg/README.md`](README.md). |
| **Experiment** | `precognition-presentiment` **v1** (`precognition-presentiment`) — [`experiments/precognition-presentiment-v1.json`](../experiments/precognition-presentiment-v1.json) |
| **`experimentHash`** | `sha256:6ac89421edea71b4cc2cfd0f753f2aa7a157222be8e0843b7e13d5d4c41ca225` — `H(PCJ(definition))` per [PSI-EXP-3]; pins parameters **and the exact stimulus pixels** (each image is `{path, sha256}`, D14). |
| **Protocol bound** | PsiMeter Verifiable-Experiment Protocol — **`[DECISION NEEDED: released version]`** (currently `0.1.0-draft`; a confirmatory registration MUST bind a *released*, immutable version — see [`prereg/README.md`](README.md) checklist). |
| **License** | CC BY 4.0 (matches the spec text). |

---

## 1. Study information

### 1.1 The two-phase frame (read this first)

PsiMeter runs in two phases (RATIONALE §5, "Two-phase architecture"); this registration is the
**confirmatory** one:

- **Exploratory / screening (the open public platform).** Anyone runs unlimited sessions. The
  per-operator **psi score** — an anytime-valid test-martingale e-value ([PSI-EVALUE-1…4], D15;
  precognition's hit-rate z is already oriented, [PSI-EVALUE-1]) — and its leaderboard live here. A
  **"Candidate"** flag (`W ≥ 1000` and `≥ 5` scored sessions, [PSI-EVALUE-4]) means **"flagged for a
  separate, pre-registered, fixed-N confirmatory replication" — never proof** (D4; D13).
  Everything on the open platform is **exploratory** and is *never* cited as confirmation.
- **Confirmatory (this document).** Frozen hypotheses, a **fixed, pre-declared N** with **no optional
  stopping** (D4, [PSI-GEN-2]), one primary outcome, one primary test, a pre-set α, and an explicit
  accept/reject rule, registered **before** the confirmatory data are generated.

The headline confirmatory arm is the **corpus hit-rate test (H2)** in §6; the **individual-ability
tests (H1)** in §7 (a low-burden population signature plus a sequential per-candidate confirmation)
are the per-operator confirmatory arm an exploratory "Candidate" flag triggers.

### 1.2 Background

The paradigm is the Bem/Bierman **presentiment** experiment (RATIONALE §7.5): before each trial the
operator is *destined* to be shown either a **calming** or a deliberately **aversive** real image —
selected by a **future** public-beacon round, so it **does not yet exist** — and must predict the
valence they sense is coming; then the actual image is shown full-screen (~4 s) so the emotion
genuinely lands. A **hit** is correctly anticipating the valence that then arrives. As with micro-PK,
any per-trial effect is small, so **no single session is evidence** (D13); inference lives in
aggregation.

The crux (RATIONALE §7.5): the reveal must be a *real affective stimulus*, not a label. The two
valence pools are a curated **CC0 image corpus** that is **part of the content-hashed definition**
(each image `{path, sha256}`, D14), so `experimentHash` pins the exact pixels of every possible
stimulus, and verifiers re-hash the served bytes ([PSI-VERIFY-6]).

### 1.3 Hypotheses (directional)

Both project hypotheses (RATIONALE §5) are stated; this experiment's **primary** confirmatory
outcome is the H2 corpus hit-rate (§6), with H1 as the per-operator confirmatory arm (§7).

- **H2 (primary here) — above-chance corpus anticipation.** Across the confirmatory corpus, the
  proportion of correctly anticipated valences is **greater than the exact chance rate**
  `p₀ = 1/optionsPerTrial = 0.5` (one-sided). The chance rate is **exact** — the valence is a single
  beacon-derived bit, `valence = SHA-256(B_R ‖ uint32(trialIndex))[0] & 1` ([PSI-PRECOG-1]) — so,
  unlike micro-PK, **no empirical baseline calibration is required**; the null is a literal fair coin.
  - **H2₀ (null):** corpus hit rate ≤ 0.5.
  - **H2₁ (alternative, directional):** corpus hit rate > 0.5.
- **H1 (secondary here) — individual consistency.** Specific operators anticipate valence above
  chance **consistently across their own sessions** (per-operator hit rate + split-half/test–retest
  reliability), tested only via **replication of exploratory-screened candidates** (§7).

---

## 2. Design plan

- **Study type.** Interactive online forced-choice data collection through the PsiMeter instrument,
  with all artifacts on the append-only, hash-chained ledger (spec §9).
- **Trials and conditions (the manipulated IV).** Per trial the operator commits a **predicted
  valence** ∈ {`calm`, `aversive`} **before** the target round is published ([PSI-PRECOG-2]). A
  session is a fixed **20 trials** (`trialsPerSession`), ≈ 2 minutes.
- **Why the two-way channel is sound.** Precognition is necessarily interactive, but each target is
  bound to a **future** beacon round `R = R0 + beaconRoundOffset` that **no party can predict at
  choice time** ([PSI-PRECOG-2], spec §3.3/§11.2) — so there is no information channel to game
  (contrast micro-PK's one-way isolation, [PSI-GEN-1]).
- **Pre-commitment & timing.** The operator signs
  `trialCommit = H(PCJ({sessionId, trialIndex, choice, targetRound, prevBeaconRound, operatorPubKey}))`
  with `R = targetRound > prevBeaconRound = R0` ([PSI-PRECOG-2]); `R > R0` is the publicly
  re-checkable fact that the choice **preceded** the target.
- **Live witnesses (the precognition-critical safeguard).** A confirmatory trial's choice commit is
  **co-signed by an independent witness while its target round is still future**
  (`witnessRound < targetRound`; the witness refuses otherwise — [PSI-WITNESS-4], D16), closing the
  **choice-timing / backdating** attack (spec §15). See §8 and its honest N = 1 limitation.
- **Ethics / consent.** A one-time **content-warning consent gate** precedes the session (the
  definition carries `contentWarning`, D14). An ethics/IRB review and an informed-consent screen may
  be required for publication (D7, **OPEN**) — resolve before the confirmatory window
  `[DECISION NEEDED: ethics/IRB status]`.

---

## 3. Variables

### 3.1 Manipulated (independent) variable

- **Predicted valence** ∈ {`calm`, `aversive`}, committed per trial **before** the target round
  ([PSI-PRECOG-2]).

### 3.2 Measured (dependent) variables — **integer counts only**

Per [PSI-CANON-3] / [PSI-LEDGER-5], only integers are committed; no rate or z is stored. The
authoritative DV is:

- **`hits`** — the integer count of trials where predicted valence equals the beacon-derived valence
  ([PSI-PRECOG-3]), out of
- **`trials`** — total trials (20 per session × the number of confirmatory sessions).

The hit rate, its z, and the psi-score wealth are **derived at analysis time** ([PSI-SCORE-1],
[PSI-EVALUE-2]) from these integer counts — never stored, never read from the server.

### 3.3 Derived statistics (computed in analysis, not stored)

- Per-session / corpus hit-rate z: `z = (hits − n·p₀) / sqrt(n·p₀·(1−p₀))`, `p₀ = 0.5` ([PSI-SCORE-1]).
- Independent sessions combine via Stouffer `Z = (Σ z)/sqrt(k)` ([PSI-SCORE-1]); the **primary** test
  (§6) uses the pooled exact binomial, with Stouffer reported alongside.

---

## 4. Published parameters (hash-bound — do not re-state, cite)

From [`experiments/precognition-presentiment-v1.json`](../experiments/precognition-presentiment-v1.json),
pinned by `experimentHash = sha256:6ac89421…` ([PSI-EXP-3]). Any change bumps version and hash and
**partitions the corpus** ([PSI-EXP-4]).

| Parameter | Value |
|---|---|
| `sessionSeconds` | 120 |
| `trialsPerSession` | **20** |
| `optionsPerTrial` | 2 → exact chance rate `p₀ = 0.5` |
| `beaconRoundOffset` | 2 (target round `R = R0 + 2`) |
| `revealHoldMs` | 4000 (image shown full-screen ~4 s so the emotion lands) |
| `choices` | `["calm", "aversive"]` |
| `stimuli` | content-hash-pinned CC0 corpus, two valence pools (D14) |
| `contentWarning` | present (consent gate, D14) |

---

## 5. Sampling plan & stopping rule

### 5.0 Unit of analysis — the corpus, not the person (read this first)

**N below is a corpus total spread across many independent participants — it is not a per-person
workload.** A presentiment corpus's evidence is gathered from the whole population: the default
N = 4 200 trials = 210 sessions is, for example, 210 people doing **one** ≈ 2-minute session each, or
~40 people doing ~5 each — **no participant spends more than a few minutes.** Per-person effort only
becomes substantial in the *named-individual* H1 confirmation (§7.2), which is **voluntary**, runs
**only on screened candidates**, and is **sequential** so a genuinely strong operator finishes early.

### 5.1 Existing data

**No confirmatory data have been collected.** Confirmatory collection begins **only after** this
registration is frozen/timestamped on OSF and the protocol version + analysis script are frozen
(see [`prereg/README.md`](README.md)). Prior exploratory/pilot sessions are **excluded** (§9).

### 5.2 Sample size (fixed N — power analysis)

**Power-analysis inputs:** **one-sided α = 0.005** (the Benjamin et al. 2018 standard), **power = 0.90**,
and the **optimistic** effect-size posture (smallest N). *(Per-person burden is distributed across the
population (§5.0), so a more conservative — larger — N is nearly free in per-person terms.)*

For a per-trial hit-rate excess `h` (true rate `0.5 + h`), the corpus hit-rate test statistic has
`E[z] = 2·h·sqrt(N_trials)`, so `N_trials = (3.8574 / (2h))²` for α = 0.005 / 90% power. At 20
trials/session:

| Assumed hit rate | `h` | `N_trials` | Sessions (÷20) |
|---|---|---|---|
| 51.0 % | 0.01 | ≈ 37 200 | ≈ 1 860 |
| 52.0 % | 0.02 | ≈ 9 300 | ≈ 465 |
| **53.0 % (headline)** | **0.03** | **≈ 4 200** | **≈ 210** |
| 55.0 % | 0.05 | ≈ 1 500 | ≈ 75 |

> **Headline (to confirm): N = 4 200 trials = 210 sessions** at an assumed **53 %** hit rate — the
> optimistic-but-defensible forced-choice benchmark (≈ Bem 2011 scale). Achieved power at this N and
> 53 % ≈ **0.90**.

> `[DECISION TO CONFIRM]` The "optimistic" posture was set in **micro-PK** terms; for a
> 2-AFC precognition task the high end (55 %) needs only ~75 sessions but is arguably too generous to
> *assume*, while 52 % / 51 % are more conservative (larger N). **Confirm the row** (default: 53 %)
> before freezing. The fixed N is whatever this row sets; **no optional stopping** (§5.3).

The **primary test is the exact binomial** (§6.1); the table sizes N via the normal approximation,
which is conservative here (exact power ≈ nominal at these N).

### 5.3 Stopping rule — **none (fixed N)**

Collection stops at **exactly** the chosen N (default 210 qualifying sessions = 4 200 trials), in
ledger-seal order. **No optional stopping, no decision-affecting interim peeking** (D4,
[PSI-GEN-2]). The confirmatory window is the contiguous block of qualifying sessions (§8) from the
first seal after registration until N is reached; the primary test (§6) is computed **once**, on the
complete block. (Operator-level optional stopping is an *exploratory*-platform property handled by
the anytime-valid e-value, [PSI-EVALUE-2]; it does not apply here, nor to candidate replications,
§7.)

---

## 6. Analysis plan — primary confirmatory test (H2)

### 6.1 Primary statistic, model, and the exact null

Pool the confirmatory corpus into total **`hits`** out of total **`trials`** (`= 20 × sessions`).
Because each valence is a single beacon-derived bit, the per-trial null is an **exact** fair coin
`p₀ = 0.5` ([PSI-PRECOG-1]) — independent across trials (each binds a distinct future round), so:

> **Primary test:** the **one-sided exact binomial test** of `hits ~ Binomial(trials, 0.5)` against
> the directional alternative **hit rate > 0.5**.

No empirical baseline calibration is needed (the advantage over micro-PK: the null is literal, not
estimated). The hit-rate z ([PSI-SCORE-1]) and the per-session Stouffer Z are reported alongside as
equivalent summaries.

### 6.2 Inference criterion / decision rule

> **Reject H2₀ in favor of the directional H2₁ iff the one-sided exact-binomial p-value ≤ 0.005**
> (equivalently, hit-rate `z ≥ 2.5758`). This is the single, pre-registered primary decision, made
> **once** on the complete N block. The hit-rate point estimate and its 99 % CI are reported
> regardless of the decision.

### 6.3 Robustness analyses (pre-registered, secondary)

- **Per-operator clustering.** Re-test treating the **operator** (or the **session**) as the unit
  (mean per-operator hit rate vs 0.5; mixed-effects / Stouffer over operators), since trials cluster
  within operators. The H2 decision is reported as robust only if the pooled and clustered analyses
  agree.
- **Leave-one-operator-out (LOO)** and a **per-operator cap** `[DECISION NEEDED: cap C — recommend
  C = 20 sessions]`, so no single heavy/fraudulent operator drives the result (RATIONALE §5/H2).
- **Experimenter exclusion (D12):** any operator key used by the experimenter role is excluded a priori (§10).

---

## 7. Analysis plan — individual-ability tests (H1)

Two H1 analyses are registered, split by per-participant burden: the **population** question (§7.1)
needs only a few short sessions per person, and the per-person **named-individual** test (§7.2) is
voluntary, screened, and sequential so genuine ability confirms early.

### 7.1 Population signature — do reliable individual differences exist? (low burden)

Across all confirmatory participants with `≥ 2` scored sessions (≈ 2 minutes each):

- **Test–retest reliability.** Split each operator's sessions in half by seal order and correlate the
  operator's hit rate across halves; a stable ability ⇒ positive correlation (RATIONALE §5/H1).
- **Variance components.** Fit a random-effects model to per-session hit counts and test whether the
  **between-operator variance exceeds** the exact Binomial(0.5) chance expectation (the null is
  exact, §6.1 — no calibration needed).
- **Decision:** one-sided α = 0.005. This answers *"do stable individual differences exist?"* at the
  population level **without any single person doing more than a handful of 2-minute sessions.**

### 7.2 Named-individual confirmation — sequential / anytime-valid (bounded, stops early)

- **Trigger.** An operator flagged **Candidate** by the *exploratory* screening psi score (`W ≥ 1000`
  and `≥ 5` scored sessions, [PSI-EVALUE-4]); screening is never itself confirmatory (D4, D15).
- **Test — the same e-value, now confirmatory.** Accumulate the test-martingale wealth `W`
  ([PSI-EVALUE-2]; precognition's hit-rate z is already oriented, [PSI-EVALUE-1]) over the candidate's
  **witnessed, confirmatory-condition** replication sessions only (screening excluded), with the
  mixture grid **and** threshold **pinned into the hash-bound definition** ([PSI-EVALUE] note,
  [PSI-WITNESS-5]).
- **Decision (anytime-valid).** **Reject that candidate's H1₀ the first time `W ≥ 1/α = 200`**
  (one-sided α = 0.005). By **Ville's inequality** this holds the false-positive rate at α under
  continuous monitoring and early stopping, so the candidate may stop the instant evidence suffices.
  > *Not the optional stopping D4 forbids:* D4 bans unprincipled stopping of a **fixed-N** test; an
  > anytime-valid e-value is the principled construction that makes stopping legitimate (the property
  > the screening score already relies on). Here the data are **witnessed/controlled**, the threshold
  > is **pre-committed**, and the operator is a **single pre-specified person**.
- **Bounded effort.** A pre-registered **maximum `N_max`** caps effort and Type II error: if
  `W < 200` at `N_max`, the candidate is **not confirmed**. Because candidates are screened for a
  *large* apparent hit rate, the expected number of trials to cross the threshold is far below the
  cap. `[DECISION NEEDED: N_max cap — recommend 12 000 trials = 600 sessions as the worst-case bound]`.
- **Multiple candidates.** Control the false-discovery rate with **e-BH** (Wang–Ramdas
  e-Benjamini–Hochberg over the terminal e-values), or Holm–Bonferroni on the anytime-valid p-values
  `min(1, 1/W)`.

---

## 8. Data-quality gate: which sessions/trials count

A session enters the confirmatory corpus **iff** every one of these holds (each mechanically
checkable; §12):

1. **Sealed and complete.** A `session.open` → `session.seal` with **all 20 trials** present and
   valid ([PSI-GEN-2]); a session with any invalid trial (§9.2) is excluded **entirely** (fixed N,
   no partial counting).
2. **Confirmatory beacon, per trial.** Every target-round pulse `B_R` **BLS-verifies**
   ([PSI-PRECOG-3], [PSI-BEACON-2/3]); dev-beacon sessions are non-confirmatory and excluded
   ([PSI-BEACON-4]). *(The target source is the future drand round **only** — fully reproducible by
   anyone with zero trust in the server's entropy, D14 — so there is no physical-entropy-source
   requirement here, unlike micro-PK.)*
3. **Witnessed (the precognition-critical check).** Each forced-choice commit is co-signed by ≥ M of
   the auditor's trusted witness set **while its target round is still future**
   (`witnessRound < targetRound`, [PSI-WITNESS-4/5], D16), plus the open and seal. **Un-witnessed
   sessions are never pooled with witnessed confirmatory data** (spec §15).
   - *Honest limitation (the frontier).* Reference deployment is **N = 1** witness; at N = 1 the
     un-forgeable time root is the **RFC 3161 TSA** (+ OTS/Bitcoin long-term), so backdating is bounded
     to TSA granularity even then ([PSI-WITNESS-6], spec §15). Credibility on this axis **scales with
     independent peers**; the project openly invites them.
4. **Verifies.** Passes every applicable check in [PSI-VERIFY-1…8] (§14), and specifically the
   per-trial re-derivation [PSI-VERIFY-6]: re-derive `{valence, imageIndex}` from `B_R`, confirm the
   shown image against the committed manifest, **re-hash the served image bytes** against
   `imageSha256`, verify each `operatorSig`, and check `targetRound > prevBeaconRound`; recompute the
   trial-list Merkle root. **A session/trial that fails any check is excluded — its exclusion is
   itself public and reproducible** (it fails `analyze.py`).

`experimentHash` mismatch → excluded and never pooled ([PSI-EXP-4]).

---

## 9. Exclusion, missing-data, and confound handling

### 9.1 Exclusions (pre-registered)

- All exploratory / pilot / pre-registration sessions.
- Any session failing the §8 gate (incomplete, dev-beacon, un-witnessed once required, or
  verification-failing) — mechanical, not a judgment call.
- Sessions under any `experimentHash` other than `sha256:6ac89421…` ([PSI-EXP-4]).
- Any sessions from operator keys used by the experimenter role (§10, D12).

### 9.2 Missing / invalid data

A trial is **invalid** (and its session excluded, per §8.1) if its `operatorSig` is absent/invalid,
its target pulse fails BLS verification, or `targetRound ≤ prevBeaconRound` ([PSI-VERIFY-6]). There is
no imputation; N is the count of *fully valid sealed* sessions.

### 9.3 Confounds and how each is neutralized

| Confound | Neutralization |
|---|---|
| **Static source bias** | **Not applicable** — the valence is an exact beacon-derived fair coin ([PSI-PRECOG-1]); spec §15 explicitly notes precognition is unaffected (no calibration needed). |
| **Choice-timing / backdating** | Live witness co-signs each choice while the target round is future (`witnessRound < targetRound`, [PSI-WITNESS-4], D16); `R > R0` re-checked at verify ([PSI-VERIFY-6]). |
| **Sensory leakage / two-way channel** | Target bound to an unpredictable **future** beacon round; no information channel exists at choice time ([PSI-PRECOG-2], spec §3.3/§11.2). |
| **Stimulus / image tampering** | Pixels pinned by `experimentHash` ({path, sha256}, D14); served bytes re-hashed at verify ([PSI-VERIFY-6]). |
| **Optional stopping** | Fixed trials/session ([PSI-GEN-2]) and fixed corpus N (§5.3); the only anytime-valid object (psi score) is exploratory-only ([PSI-EVALUE-2]). |
| **Multiple comparisons** | One primary test (§6.2); leaderboard ≠ evidence (D4); candidate replications use Holm–Bonferroni (§7). |
| **Untrusted experimenter** | Integrity path: re-computation from public artifacts (§3.2/§14), not trust — see §12. |
| **Experimenter-as-subject (D12)** | The experimenter role is barred from the confirmatory subject pool (§10); LOO + per-operator cap (§6.3). |
| **Sybil / multi-key** | Screening-only; answered by the confirmatory phase + optional stronger identity for candidates (D6/D9). |

---

## 10. Experimenter / subject separation (D12) and the analyst role

**The experimenter is not a confirmatory subject.** Confirmatory data are collected only from
independent public participants. Anyone in the **experimenter role** — operating the instrument, its
servers, witnesses, or infrastructure — is excluded from the confirmatory subject pool, and any such
operator key is pre-declared and excluded a priori (§9.1). This is the strongest form of the D12
safeguard (total experimenter/subject separation): it removes the "PEAR Operator 10" risk from the
headline entirely, and — being a **structural rule about a role** — it holds no matter who fills that
role, so the result stands even if the instrument is later run by someone else or the work is
published anonymously.

**The analyst is not a trusted role either.** Every confirmatory number is produced by an open,
deterministic script (`analysis/analyze.py`) run over the **public** ledger, so its output does not
depend on who runs it (integrity/statistical-path separation, spec §3.2; [PSI-VERIFY-9]). To remove
any post-hoc latitude:

1. **Freeze and hash-anchor the analysis pipeline before collection** — pin the exact `analyze.py`
   (git commit SHA + a file hash) and this decision rule, and anchor them into the ledger alongside
   the OSF DOI (§13), mirroring the experiment-definition discipline (D13) and the pinning of the psi
   grid / witness set ([PSI-EVALUE] note, [PSI-WITNESS-5]). After the freeze, the confirmatory number
   is simply *whatever the pre-registered script outputs over the public ledger* — re-runnable by
   anyone ([PSI-VERIFY-9], §12).
2. **An independent lead analyst / co-signer is invited** to co-sign the freeze, hold the
   lead-analyst role, and co-hold the ledger anchors (D12). This strengthens credibility but is **not
   required for validity**, because step 1 already makes every number mechanically reproducible.
   `[DECISION NEEDED: name an independent lead analyst, or register with the invitation standing and
   add by amendment before confirmatory collection.]`

This mirrors the witness design's honest frontier (spec §15): strength on the human-independence axis
grows as others participate, but the headline never rests on trusting any individual — the chain is
self-verifying and the analysis is frozen, deterministic, and public.

---

## 11. What would falsify this — and the honest power caveat

- **Confirmation of H2₁:** one-sided exact-binomial p ≤ 0.005 at the fixed N (§6.2), reported with the
  clustered/LOO robustness (§6.3): a result that **fails LOO or the per-operator clustering** is
  reported as *carried by one operator*, **not** a general corpus effect.
- **A confirmed candidate (H1):** a flagged operator whose **replication** clears the
  Holm–Bonferroni threshold (§7). A flagged candidate who **fails** replication has that H1 claim
  **disconfirmed** (the expected outcome if the flag was chance).
- **The honest underpowered caveat (D13).** N is powered for the **headline** assumed hit rate (default
  53 %). If the true effect is smaller, a **null is inconclusive, not disconfirming**: at N = 4 200
  trials, power is ≈ **0.51** at a 52 % true rate and ≈ **0.10** at 51 %. So a null here **disconfirms
  an effect of the assumed size or larger** and does **not** rule out a smaller one. To make a null
  *disconfirm a small presentiment effect*, pre-register an extension to a larger N and/or a **TOST
  equivalence test** against a smallest-effect-of-interest `[DECISION NEEDED: equivalence bound /
  larger-N extension, or accept that a null at the chosen N is only "no effect of the assumed size"]`.

---

## 12. Distinctive feature — every result is independently re-verifiable

As with micro-PK, the confirmatory numbers can be re-derived from public artifacts by anyone,
trusting neither the server nor its code (spec §3.1):

- **Offline:** `python analysis/analyze.py ledger/<file>.jsonl` re-runs verification
  ([PSI-VERIFY-1…9]) — including the full presentiment chain **beacon → committed image hash →
  re-hashed pixels → valence → hit** ([PSI-VERIFY-6]) — and recomputes the hit-rate statistic from
  the integer counts.
- **In-browser:** the `/verify` view performs the same per-trial chain client-side.
- **Cross-language byte-parity** is CI-enforced via the shared test vectors
  (`analyze.py --check-vectors`, spec Appendix A; the presentiment vector is `presentiment.json`).
- **Binding the registration to the ledger (bidirectional pre-commitment):** see the shared procedure
  in [`prereg/README.md`](README.md) §"Anchor the registration into the ledger".

---

## 13. AsPredicted-style 9-question summary

1. **Have any data been collected for this study already?**
   No. Confirmatory collection starts only after this registration is frozen/timestamped on OSF and
   the protocol version + `analyze.py` are frozen. Prior exploratory/pilot sessions are excluded.
2. **What's the main hypothesis being tested?**
   That operators anticipate the valence of a not-yet-determined image above chance: the corpus hit
   rate is **greater than 0.5** (H2₁, one-sided). Secondary: specific screened operators replicate a
   consistent above-chance hit rate (H1).
3. **Describe the key dependent variable(s) and how they are measured.**
   Integer **`hits`** out of **`trials`** (20 per session), where a hit is predicted valence =
   beacon-derived valence ([PSI-PRECOG-3], [PSI-LEDGER-5]); no rate/z stored.
4. **How many and which conditions?**
   A per-trial forced choice between **`calm`** and **`aversive`** (`optionsPerTrial = 2`,
   `p₀ = 0.5`); 20 trials/session.
5. **Specify exactly the analyses for the main hypothesis.**
   One-sided **exact binomial test** of `hits ~ Binomial(trials, 0.5)` vs hit rate > 0.5; **reject
   H2₀ iff p ≤ 0.005**. Secondary: per-operator clustering, LOO, cap; the individual-ability arm
   (§7).
6. **Outliers and exclusions.**
   No value-based outliers (counts are exact). Mechanical exclusions only: incomplete, dev-beacon,
   un-witnessed (once required), wrong-`experimentHash`, or verification-failing sessions/trials; and
   any experimenter-role sessions (D12). See §8–§9.
7. **Sample size / how N is determined.**
   **Fixed N** (default **4 200 trials = 210 sessions**) from a power analysis at one-sided
   α = 0.005, 90 % power, assumed 53 % hit rate (`[DECISION TO CONFIRM]`, §5.2). **No optional
   stopping** (D4); the primary test is computed once on the complete block.
8. **Anything else being pre-registered?**
   The two-tier H1 plan (§7 — population reliability + a sequential, anytime-valid named-individual confirmation, e-BH across candidates); robustness/clustering analyses (§6.3); the honest
   underpowered caveat / optional equivalence extension (§11); the content-warning consent gate and
   pending ethics review (D7); and that every result — including the full beacon→pixels→valence→hit
   chain — is re-verifiable from public artifacts (§12).
9. **Study name / type.**
   "Presentiment (forced-choice precognition)" — a confirmatory, fixed-N, cryptographically auditable
   online experiment under the PsiMeter protocol. Type: confirmatory hypothesis test.

---

## 14. Open decisions to resolve before freezing

- `[DECISION TO CONFIRM]` The **assumed hit rate / N row** (default 53 % → 210 sessions) (§5.2).
- `[DECISION NEEDED]` Named **independent lead analyst / co-signer**, or register with the open
  invitation standing (§10).
- `[DECISION NEEDED]` Per-operator **cap C** (recommended 20) (§6.3) and **N_max cap** for the
  sequential named-individual confirmation (recommended 600 sessions) (§7.2).
- `[DECISION NEEDED]` Whether to register a **larger-N extension and/or TOST equivalence bound** so a
  null can *disconfirm* a small effect (§11).
- `[DECISION NEEDED]` **Ethics/IRB status** and informed-consent screen (D7) before the confirmatory
  window (§2).
- `[DECISION NEEDED]` **Embargo:** default **none** (open by default, RATIONALE design pillar 7); OSF
  permits up to a 4-year embargo if desired.
- `[DECISION NEEDED]` The **released protocol version** to bind (not `0.1.0-draft`).

*See [`prereg/README.md`](README.md) for the step-by-step OSF registration + ledger-anchoring
checklist.*

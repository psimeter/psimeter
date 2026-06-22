# PsiMeter pre-registrations (`prereg/`)

This directory holds the **public, time-stamped scientific commitments** for PsiMeter's confirmatory
claims. They are deliberately **separate** from the protocol specification:

- [`spec/`](../spec/) — the **normative protocol**: canonicalization, cryptography, ledger,
  experiment kinds, scoring, witnesses, and the verification procedure. *How a result is made
  auditable.* Single source of truth ([`spec/README.md`](../spec/README.md)); it even states that
  hypotheses, the pre-registered analysis, and stopping rules "belong in a pre-registration (e.g.
  OSF)" — i.e. here.
- `prereg/` (this directory) — the **scientific pre-registration**: hypotheses, fixed sample size,
  primary outcome, analysis plan, and decision rule, frozen **before** the confirmatory data exist.
  *What is predicted, and the rule that prevents HARKing / p-hacking / optional stopping (D4).*

> **Golden rule.** Where a pre-reg overlaps the protocol, it **cites** the spec's `[PSI-*]`
> requirement IDs and the `D#` decision-log items (in [`spec/RATIONALE.md`](../spec/RATIONALE.md))
> rather than restating them. **On any conflict, the spec wins.**

## The two registrations

This project registers **two separate OSF registrations** (one per experiment paradigm),
independently:

| File | Experiment | `experimentHash` ([PSI-EXP-3]) | Primary confirmatory test |
|------|-----------|--------------------------------|---------------------------|
| [`osf-preregistration-micropk.md`](osf-preregistration-micropk.md) | `binary-micropk` v1 | `sha256:6b22640e…` | oriented **HIGH−LOW** Stouffer `Z* ≥ 2.5758` (one-sided α = 0.005), N = 520 + 260 baseline |
| [`osf-preregistration-precognition.md`](osf-preregistration-precognition.md) | `precognition-presentiment` v1 | `sha256:6ac89421…` | **exact-binomial** hit rate > 0.5, p ≤ 0.005, N = 4 200 trials (default, `[DECISION TO CONFIRM]`) |

Both bind: one-sided **α = 0.005** (Benjamin et al. 2018), **90 % power**, the **optimistic**
effect-size posture, **fixed N / no optional stopping** (D4), and the **experimenter-not-a-subject**
stance (D12) — see each document's §5, §10, §11.

## The exploratory ↔ confirmatory distinction (the crux)

PsiMeter's public platform — including the per-operator **psi-score** leaderboard (an anytime-valid
e-value, [PSI-EVALUE-1…4], D15) — is an **exploratory SCREENING** instrument. A **"Candidate"** flag
(`W ≥ 1000` and `≥ 5` sessions) means *"flagged for a separate, pre-registered, fixed-N confirmatory
replication"* — **never proof** (D4: the leaderboard is not evidence; D13: a single session has ~no
power). **These pre-registrations are that fixed-N confirmatory protocol.** The open platform is
framed as exploratory throughout; only the registered tests here (and the candidate replications they
define) are confirmatory.

## Distinctive feature: results bind to the cryptographic ledger

Unlike a conventional pre-reg, every confirmatory number is **independently re-derivable from public
artifacts** — trusting neither the server nor its code (spec §3.1):

- `python analysis/analyze.py ledger/<file>.jsonl` re-runs the full verification procedure
  ([PSI-VERIFY-1…9], spec §14) and recomputes every statistic from the integer counts (`ones` /
  `nSamples`, `hits` / `trials` — no stored z, [PSI-LEDGER-5]).
- The in-browser `/verify` view performs the same checks client-side.
- Cross-language byte-parity is CI-enforced via the shared test vectors
  (`analyze.py --check-vectors`, spec Appendix A, G6).

---

## Registering on OSF (a manual external step performed by the registrant)

Registering on **osf.io** cannot be done from this repo — it is a manual step that creates the
frozen, timestamped artifact. Recommended order:

### A. Before you register
1. **Resolve the `[DECISION NEEDED]` / `[DECISION TO CONFIRM]` items** in each pre-reg (collected in
   each document's final section): the independent lead analyst (§10), the per-operator cap and
   `N_max` cap, the precognition hit-rate row, any equivalence/extension test, the micro-PK bit-rate
   choice, the embargo, and the ethics/IRB status (precognition, D7).
2. **Freeze the immutable inputs** (a confirmatory registration must bind *released*, not draft,
   artifacts):
   - the **protocol version** — release `spec/psimeter-protocol.md` past `0.1.0-draft` and cite that
     version (conformance is per-version, [`spec/README.md`](../spec/README.md));
   - the **experiment definitions** (`experiments/*.json`) — already content-hashed ([PSI-EXP-4]);
   - the **analysis pipeline** — record the exact `analysis/analyze.py` git commit SHA + a file hash
     (§10 of each pre-reg).
3. **Verify the embedded hashes** are still correct (they are derived facts, not assertions):
   ```bash
   # experimentHash ([PSI-EXP-3]) — must match the values in the table above
   python - <<'PY'
   import json, hashlib
   for f in ["experiments/binary-micropk-v1.json","experiments/precognition-presentiment-v1.json"]:
       d = json.load(open(f, encoding="utf-8"))
       c = json.dumps(d, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
       print(f, "sha256:" + hashlib.sha256(c).hexdigest())
   PY
   ```
4. **Compute the flat SHA-256 of each frozen pre-reg file** (used for the bidirectional bind below):
   ```bash
   python -c "import hashlib,sys; print('sha256:'+hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" prereg/osf-preregistration-micropk.md
   ```

### B. Create the registration
5. On **osf.io**, create a project and add a **Preregistration** (the OSF "Preregistration" /
   AsPredicted templates match the section layout of these documents — Study Information, Design,
   Sampling Plan, Variables, Analysis Plan). Paste in (or attach) the relevant `prereg/*.md` and the
   AsPredicted 9-question summary (§13 of each).
6. **Embed the cryptographic anchors in the OSF registration itself:** the bound **protocol version**,
   both **`experimentHash`** values, the **`analyze.py` commit SHA**, and the current **PsiMeter
   ledger head hash** (or genesis hash). This makes the OSF record point *into* the ledger.
7. **Submit / freeze** the registration. OSF assigns a **DOI** and an immutable timestamp. (Do this
   **twice** — one registration per experiment.)

### C. Anchor the registration into the ledger (bidirectional pre-commitment)
Consistent with the project's own ethos (pre-commit, then anchor externally, D2):
8. Record the OSF **DOI/URL** and the **pre-reg file SHA-256** (step 4) in the repo, and reference
   them from the **next external anchor** so they ride into the tamper-evident chain:
   ```bash
   npm run anchor    # publishes the ledger head + an OpenTimestamps receipt (spec §9 external.anchor)
   ```
   The OSF record now binds the ledger head (step 6) **and** the ledger's anchor receipt records the
   OSF DOI + pre-reg hash — so the registration and the corpus mutually freeze each other.
   *(Minting a dedicated ledger entry type for this would be a protocol change — out of scope for a
   docs-only change; use the existing `external.anchor` receipt + a committed note here.)*

### D. Only then
9. **Open the confirmatory collection window.** The window is the contiguous block of qualifying,
   witnessed, verifying sessions (each pre-reg §8) from the first seal after registration until the
   fixed N is reached — analyzed **once** (no optional stopping, D4).

---

## Status

**DRAFT.** The core scientific decisions are filled in (scope = two pre-regs; α = 0.005 / 90 % power;
optimistic effect size; experimenter-not-a-subject). Remaining open items are marked
`[DECISION NEEDED]` / `[DECISION TO CONFIRM]` inline and gather in each document's final section.
Nothing here is registered until the checklist above is completed.

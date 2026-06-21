# The PsiMeter Verifiable-Experiment Protocol

| | |
|---|---|
| **Version** | 0.1.0-draft |
| **Status** | Draft — normative once released (see [README](README.md)) |
| **Date** | 2026-06-21 |
| **Editor** | Adler Oliveira |
| **Conventions** | BCP 14 ([RFC 2119](https://www.rfc-editor.org/info/rfc2119), [RFC 8174](https://www.rfc-editor.org/info/rfc8174)) |

> **Abstract.** PsiMeter is a platform for large-scale, anonymous, web-based experiments that
> test for putative "psi" effects (intention-biased true randomness; forced-choice
> precognition). This document specifies the **verifiable-experiment protocol** beneath it: the
> canonical data encoding, the cryptographic primitives and their domain separation, the
> per-session pre-commitment and human anchor, public-beacon binding, the append-only
> hash-chained ledger, per-experiment-kind generation and scoring, the independent live-witness
> protocol, and the end-to-end verification procedure. The protocol is built around a single
> axiom — **the experimenter is untrusted** — so that any third party can independently verify
> every published result, and build an interoperable implementation, from public artifacts
> alone.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Conventions and terminology](#2-conventions-and-terminology)
3. [Architecture and trust model (Informative)](#3-architecture-and-trust-model-informative)
4. [Canonicalization](#4-canonicalization)
5. [Cryptographic primitives and domain separation](#5-cryptographic-primitives-and-domain-separation)
6. [Experiment definitions](#6-experiment-definitions)
7. [Pre-commitment and anchor](#7-pre-commitment-and-anchor)
8. [Public-beacon binding](#8-public-beacon-binding)
9. [Ledger format](#9-ledger-format)
10. [Generation and output commitment](#10-generation-and-output-commitment)
11. [Experiment kinds](#11-experiment-kinds)
12. [Scoring](#12-scoring)
13. [Witness protocol](#13-witness-protocol)
14. [Verification procedure](#14-verification-procedure)
15. [Security considerations](#15-security-considerations)
16. [Conformance](#16-conformance)
17. [References](#17-references)
- [Appendix A. Test vectors](#appendix-a-test-vectors)
- [Appendix B. Design rationale](#appendix-b-design-rationale)

> **Drafting status.** Sections 1–7, 16, and 17 are written. Sections 8–15 are present as scoped
> stubs that name the source material, the implementing module, and the frozen golden vectors
> they will formalize; they are being filled in section order. Nothing in a stub is normative
> yet.

---

## 1. Introduction

### 1.1 Scope

This document specifies everything required to **produce** PsiMeter experiment artifacts and to
**independently verify** them:

- the canonical byte encoding used for all hashing and signing (§4);
- the cryptographic primitives and their domain separation (§5);
- the experiment-definition object and its content hash (§6);
- the per-session pre-commitment and the human-readable anchor (§7);
- binding each session to a public randomness beacon (§8);
- the append-only, hash-chained ledger and its entry formats (§9);
- one-way generation and the streaming output commitment (§10);
- the two experiment kinds — binary micro-PK and forced-choice presentiment (§11);
- display vs. authoritative scoring, including the anytime-valid per-operator e-value (§12);
- the independent live-witness protocol (§13);
- the verification procedure an auditor follows (§14).

The following are **out of scope**, by design:

- **The scientific claims.** Hypotheses, the pre-registered confirmatory analysis, sample sizes,
  and stopping rules belong in a pre-registration (e.g. OSF), not in this protocol. This document
  specifies only what makes those claims *auditable*.
- **User interface and gamification.** The protocol constrains what the UI may and may not do
  (notably one-way isolation, §3.3), but does not specify its appearance.
- **Deployment and operations.** Hosting, scaling, and rate-limiting are implementation matters.

### 1.2 Design goals

- **G1 — Independent verifiability.** A third party with only the public artifacts can confirm
  every claim in §14 without trusting the operator or the operator's code.
- **G2 — Independent implementability.** A third party can build a *generator* (an instrument)
  and/or a *verifier* from this document that interoperate with conforming peers.
- **G3 — Pre-commitment.** Every operator decision is cryptographically fixed *before* the
  relevant randomness exists (§7, §11).
- **G4 — Freshness.** Every session provably did not exist before a known public moment (§8).
- **G5 — Tamper-evidence.** The corpus cannot be silently edited, reordered, truncated, or
  backdated (§9, §13).
- **G6 — Cross-language byte-parity.** Independent implementations in different languages produce
  *byte-identical* commitments; this is enforced by the test vectors (Appendix A).

### 1.3 Relationship to other artifacts

- The **reference implementation** lives in `packages/` (TypeScript core + server + witness;
  Rust entropy sidecar). The correctness-critical logic is the pure, I/O-free
  [`packages/core`](../packages/core).
- The **reference verifier** is [`analysis/analyze.py`](../analysis/analyze.py) (Python, standard
  library), complemented by an in-browser verifier.
- The **rationale** for every decision is the informative companion [`RATIONALE.md`](RATIONALE.md).
- The **wiki** (`packages/client` `/docs`) is the friendly rendering; it cites this document.

### 1.4 Status of this document

This is a **self-published** specification. It adopts the conventions and rigor of IETF RFCs but
is **not** an IETF product and has not been through the IETF process. See the
[README](README.md) for the versioning and conformance policy.

---

## 2. Conventions and terminology

### 2.1 Requirement keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
"RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as
described in BCP 14 [RFC 2119] [RFC 8174] when, and only when, they appear in all capitals, as
shown here.

### 2.2 Requirement identifiers

Each normative requirement is tagged with a permanent identifier `[PSI-<AREA>-<n>]`. Identifiers
are stable across versions and are cited by code, tests, and the wiki. A withdrawn requirement's
identifier is retired, never reused.

### 2.3 Notation

- **Octet.** An 8-bit byte. `0x00` denotes a single octet with value zero.
- **`‖`.** Concatenation of octet strings.
- **`H(x)`.** The SHA-256 digest of octet string `x` (§5.1), as 32 raw octets.
- **Canonical form / `PCJ(v)`.** The PsiMeter Canonical JSON encoding of a JSON value `v` (§4),
  as a UTF-8 octet string.
- **Tagged string.** A self-describing value of the form `<tag>:<encoding>`. This document
  defines `sha256:<64-hex>` for digests and Merkle roots (§5) and `ed25519:<encoding>` for public
  keys and signatures (§5.3, §9). The tag makes stored values algorithm-agile and unambiguous.
- **JSON value types** are as in [RFC 8259], restricted by §4.

### 2.4 Terminology

| Term | Definition |
|---|---|
| **Experiment** | A protocol/type, identified by an `id` and integer `version`, with a content-hashed parameter block (§6). |
| **Experiment kind** | The behavioural family an experiment belongs to: `micro-pk-binary` or `precognition-presentiment` (§11). |
| **Session** (run) | One execution of an experiment by one operator, of fixed, pre-declared length. |
| **Operator** | The anonymous/pseudonymous participant, identified by a client-held Ed25519 key. |
| **Intention / Choice** | The operator's pre-declared decision (micro-PK: `HIGH`/`LOW`/`BASELINE`; precognition: a per-trial valence prediction). |
| **Pre-commitment** | A hash, published before the relevant randomness exists, binding the decision, parameters, identity, and freshness (§7). |
| **Anchor** | A short human-readable encoding of the pre-commitment, shown to the operator as the focal point and as personal proof (§7). |
| **Reveal** | Post-event publication of the values that let anyone verify a commitment. |
| **Beacon** | An external public randomness source whose value did not exist before a known time (§8). |
| **Baseline / calibration** | Operator-absent runs through the identical pipeline, used to characterize the source (excluded from scoring). |
| **Ledger** | The append-only, hash-chained log of all entries (§9). |
| **Trial** | A single forced-choice event (precognition) or a fixed block of raw bits (micro-PK). |
| **Witness** | An independent process that co-signs artifacts in real time on its own hash-chained feed (§13). |
| **Psi score** | A per-operator anytime-valid e-value summarizing consistent, declared-direction deviation across that operator's sessions (§12). |
| **Verifier** | Any party (or program) that re-checks artifacts per §14. |

---

## 3. Architecture and trust model (Informative)

*This section is informative; it frames the normative requirements that follow.*

### 3.1 The untrusted-experimenter axiom

A credible result must not require trusting the server operator, the host, or the operator's
code. Every load-bearing claim is verifiable by **re-computation** from published artifacts. This
single axiom drives the cryptographic design.

### 3.2 The two trust paths

A reviewer's trust divides cleanly:

- **Integrity path (cryptographic).** Capture raw bits, commit, sign, hash-chain, log. Verified
  by re-computation (§14) — **language-independent**: SHA-256, Ed25519, and the Merkle
  construction behave identically everywhere, so an auditor re-checks them and never trusts this
  implementation.
- **Statistical path (inference).** Every confirmatory number is produced by an open,
  deterministic analysis run over the *published raw data* — never by the live server. On-screen
  statistics are **display-only**.

Because the server sits only in the integrity path (which is self-verifying) and never in the
statistical path, the choice of server language carries no scientific risk.

### 3.3 One-way isolation of the generator

During micro-PK generation the random process reads **nothing** from the client; isolation is
architectural, not a policy. (Precognition is necessarily interactive but is sound because each
target is bound to a future beacon round that no party can predict at choice time — §11.2.)

### 3.4 Components and roles

Operator/client · Server/orchestrator · Generator (isolated) · Entropy source (physical) ·
Public beacon · Ledger · Witness · Verifier. Their interactions are specified in §7–§14.

---

## 4. Canonicalization

All hashing and signing in this protocol operate on **PsiMeter Canonical JSON (PCJ)**, a
restricted profile of JSON Canonicalization Scheme ([RFC 8785], "JCS"). Restricting the value
space removes JCS's only cross-language hazard (number formatting) for this application.

- **[PSI-CANON-1]** The canonical form of a value MUST be its JSON serialization with object
  members sorted (PSI-CANON-2), with the two-character separators `,` (between members and
  between array elements) and `:` (between a member name and its value), and with **no**
  insignificant whitespace.
- **[PSI-CANON-2]** Object member names MUST be sorted in ascending order by their UTF-16
  code units, as in [RFC 8785] §3.2.3. Member names MUST consist solely of Basic Multilingual
  Plane code points (no surrogate pairs); within this restriction, UTF-16 code-unit order and
  Unicode code-point order coincide, so an implementation that sorts by code point (e.g. Python's
  `sort_keys`) produces identical output. In practice all member names in this protocol are
  US-ASCII.
- **[PSI-CANON-3]** Numbers MUST be finite integers in the safe-integer range
  −(2⁵³ − 1) … 2⁵³ − 1 inclusive. Non-integer numbers, values outside that range, `NaN`, and the
  infinities MUST be rejected (the implementation MUST raise an error rather than emit output).
  *Every committed quantity in PsiMeter is an integer or a string; derived statistics are
  display-only and never appear in a committed payload.*
- **[PSI-CANON-4]** An object member whose value is absent/undefined MUST be omitted from the
  canonical form. The JSON `null` is a distinct, permitted value and MUST be serialized as
  `null`. *This is what allows new optional fields to be added to a payload without changing the
  hash of values that omit them (D13).*
- **[PSI-CANON-5]** Strings MUST be escaped exactly as in [RFC 8785] §3.2.2.2 (minimal escaping;
  the solidus `/` is not escaped; control characters use lower-case `\uXXXX`). The input MUST be
  valid Unicode.
- **[PSI-CANON-6]** Array element order is significant and MUST be preserved; elements are
  canonicalized recursively.
- **[PSI-CANON-7]** `true`, `false`, and `null` MUST serialize as the literals `true`, `false`,
  and `null` respectively.

*Reference reproductions.* The TypeScript reference is
[`canonicalize.ts`](../packages/core/src/canonicalize.ts). The Python form is exactly
`json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)` over a value whose
numbers are all integers.

*Test vectors:* [`test-vectors/canonicalization.json`](test-vectors/canonicalization.json).

---

## 5. Cryptographic primitives and domain separation

### 5.1 Hash function and hash strings

- **[PSI-HASH-1]** The hash function is **SHA-256** [FIPS 180-4].
- **[PSI-HASH-2]** A **hash string** is the lower-case hexadecimal digest prefixed with
  `sha256:` (66 characters total). Stored and transmitted digests MUST use this tagged form
  (PSI-CANON applies to it as an ordinary string).
- **[PSI-HASH-3]** When hashing a text value, the input MUST be its UTF-8 encoding.
- **[PSI-HASH-4]** When hashing a structured value, the input MUST be the UTF-8 encoding of its
  canonical form (§4); i.e. `H(PCJ(v))`.

### 5.2 Merkle tree

A binary Merkle tree commits to an ordered sequence of leaves (used for the streaming output
commitment and checkpoint roots, §10) with domain separation so a leaf preimage can never be
reinterpreted as an internal node.

- **[PSI-MERKLE-1]** A leaf over octet string `d` is `leaf(d) = H(0x00 ‖ d)`.
- **[PSI-MERKLE-2]** An internal node over child digests `l` and `r` (32 octets each) is
  `node(l, r) = H(0x01 ‖ l ‖ r)`. Levels are reduced left-to-right in adjacent pairs.
- **[PSI-MERKLE-3]** When a level has an odd number of nodes, the final node MUST be **promoted
  unchanged** to the next level. Last-node duplication (the Bitcoin convention) MUST NOT be used,
  as it admits a duplicate-leaf ambiguity.
- **[PSI-MERKLE-4]** The root of a single-leaf tree is that leaf's digest. An empty tree has no
  root; computing one MUST be an error.
- **[PSI-MERKLE-5]** A Merkle root is emitted as a hash string (`sha256:…`, §5.1). *(This
  supersedes the `merkle:…` placeholder used in the legacy design sketch.)*

*Reference:* [`merkle.ts`](../packages/core/src/merkle.ts).
*Test vectors:* [`test-vectors/primitives.json`](test-vectors/primitives.json).

### 5.3 Digital signatures

- **[PSI-SIG-1]** Operator and witness signatures are **Ed25519** [RFC 8032].
- **[PSI-SIG-2]** Public keys and signatures are carried as tagged strings of the form
  `ed25519:<lower-hex>`: a public key is 32 octets (64 hex digits) and a signature is 64 octets
  (128 hex digits).
- **[PSI-SIG-3]** Unless a context states otherwise, a signature is computed over the **UTF-8
  octets of the referenced message string** — typically a `sha256:` hash string (§5.1), signed as
  text, *not* over the raw digest octets. Each signing context names its message: the operator
  pre-commitment signature (§7.3), the per-trial choice signature (§11.2), and witness
  attestations (§13).

*Test vectors for signature-bearing constructions ship with their sections (§7, §13).*

---

## 6. Experiment definitions

An **experiment definition** is the versioned, immutable, content-addressed parameter set a
session runs under. Its hash is bound into every pre-commitment (§7), pinning the exact parameters
without inlining them.

### 6.1 The definition object

| Member | Type | Notes |
|---|---|---|
| `id` | string | stable experiment identifier |
| `version` | integer | incremented on any change (§6.1) |
| `title` | string | human label |
| `kind` | string | the experiment kind (§11): `micro-pk-binary` or `precognition-presentiment` |
| `params` | object | kind-specific parameters (integers/strings only) |
| `intentions` | array of string | committable vocabulary for micro-PK (`HIGH`/`LOW`/`BASELINE`); OPTIONAL |
| `choices` | array of string | committable vocabulary for other kinds; OPTIONAL |
| `stimuli` | object | OPTIONAL kind-specific presentation data, frozen per version |

- **[PSI-EXP-1]** A definition MUST contain `id` (string), `version` (integer ≥ 1), `title`
  (string), `kind` (string, one of the registered kinds, §11), and `params` (object). It MUST
  contain at least one of `intentions` or `choices`, each an array of strings giving the
  committable choice vocabulary. It MAY contain `stimuli`. The vocabulary in effect is `choices`
  if present, otherwise `intentions`, so a verifier reads either uniformly.
- **[PSI-EXP-2]** Every value within `params` and `stimuli` MUST satisfy §4 (integers and strings
  only, nested in arrays/objects). Real-valued quantities (e.g. a trial's standard deviation) MUST
  NOT be stored; they are derived from the integers at analysis time.
- **[PSI-EXP-3]** The experiment hash is `experimentHash = H(PCJ(definition))` (§4, §5.1), emitted
  as a hash string.
- **[PSI-EXP-4]** A definition is immutable once published. Any change to any member MUST increment
  `version`, which changes `experimentHash`. Two sessions whose definitions differ in
  `experimentHash` MUST NOT be pooled in a single confirmatory analysis. *(Because §4 omits absent
  members, introducing a new OPTIONAL member to the schema does not change the hash of definitions
  that omit it — the format can grow without invalidating sealed sessions.)*

### 6.2 Example

The abbreviated `binary-micropk` test definition canonicalizes (§4) to

```
{"id":"binary-micropk","intentions":["HIGH","LOW","BASELINE"],"kind":"micro-pk-binary","params":{"trialBits":200},"title":"test","version":1}
```

giving `experimentHash = sha256:ab17b4de…`. Changing `params.trialBits` to `201` yields a
different hash (`sha256:0a9e21cf…`), partitioning the corpus.

*Reference:* [`experiment.ts`](../packages/core/src/experiment.ts).
*Test vectors:* [`test-vectors/experiment.json`](test-vectors/experiment.json).

## 7. Pre-commitment and anchor

Before any randomness relevant to a session exists, the operator's decision and the session's full
context are frozen into one hash — the **pre-commitment** — from which a short human **anchor** is
derived. This is what makes each session pre-registered at the per-session level (G3) and is the
focal artifact the operator records.

### 7.1 The pre-commitment input

The pre-commitment is taken over a JSON object, the **PrecommitInput**:

| Member | Type | Notes |
|---|---|---|
| `experimentId` | string | the definition's `id` (§6) |
| `experimentVersion` | integer | the definition's `version` |
| `experimentHash` | hash string | pins the exact parameters (§6) |
| `intention` | string | the committed choice (§6 vocabulary); per-trial kinds commit `""` (§11.2) |
| `operatorPubKey` | string | `ed25519:<hex>` (§5.3) |
| `beacon` | object | the bound beacon pulse (§8), itself canonical: `{source, round, value, …}` |
| `sessionId` | string | unique session identifier |
| `serverNonce` | string | server-chosen nonce |
| `prevHash` | hash string | the ledger head at commit time (§9) |

- **[PSI-PRECOMMIT-1]** A PrecommitInput MUST contain exactly the members above and no others;
  `beacon` is a nested canonical object (§8). All values MUST satisfy §4.
- **[PSI-PRECOMMIT-2]** The pre-commitment is `precommit = H(PCJ(PrecommitInput))` (§4, §5.1),
  emitted as a hash string. Because §4 sorts member names, this is a hash over the **canonical
  object**, not a field concatenation; the canonical member order is `beacon, experimentHash,
  experimentId, experimentVersion, intention, operatorPubKey, prevHash, serverNonce, sessionId`.
  *(This supersedes the informal `H(a ‖ b ‖ c)` notation of the legacy design doc.)*
- **[PSI-PRECOMMIT-3]** The committed-decision member MUST be named `intention` for every kind (its
  value is a generic string), so micro-PK and per-trial kinds share one commitment format and
  previously sealed sessions stay byte-stable.

### 7.2 The anchor

- **[PSI-ANCHOR-1]** The anchor encodes the **first 60 bits** (first 15 hex digits) of the
  precommit digest as twelve Crockford base-32 symbols over the alphabet
  `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no `I`, `L`, `O`, `U`); each group of 5 bits maps to one
  symbol, most-significant first.
- **[PSI-ANCHOR-2]** The twelve symbols MUST be displayed as three hyphen-separated groups of four:
  `XXXX-XXXX-XXXX`. The encoding is deterministic; input is case-insensitive.

The anchor is a human-checkable fingerprint of the *whole commitment* — intention, parameters,
identity, and freshness — not of a "seed". The operator records it as independent proof of exactly
what was committed.

### 7.3 Operator signature

- **[PSI-PRECOMMIT-4]** The operator MUST sign the pre-commitment with their Ed25519 key (§5.3,
  [PSI-SIG-3]): the signed message is the **UTF-8 octets of the `precommit` hash string**. The
  resulting `operatorSig` (`ed25519:<hex>`) authenticates the commitment and provides
  non-repudiation; a verifier checks it against `operatorPubKey` over those same bytes.

### 7.4 Example

The test PrecommitInput canonicalizes to

```
{"beacon":{"round":1,"source":"drand","value":"ff"},"experimentHash":"sha256:ab17b4de…","experimentId":"binary-micropk","experimentVersion":1,"intention":"HIGH","operatorPubKey":"ed25519:abc","prevHash":"sha256:84fd9bac…","serverNonce":"n1","sessionId":"s1"}
```

giving `precommit = sha256:b227153c…` and `anchor = P8KH-AF4S-EM8E`.

*Reference:* [`commitment.ts`](../packages/core/src/commitment.ts),
[`identity.ts`](../packages/client/src/identity.ts).
*Test vectors:* [`test-vectors/precommit.json`](test-vectors/precommit.json) (including an Ed25519
KAT over the example precommit).

## 8. Public-beacon binding

> *Stub — to be written.* Will specify the `BeaconRef` object, the use of drand **quicknet**
> (unchained, 3 s), and the requirement to **BLS-verify** each pulse against the hardcoded group
> public key before binding it — never trusting the beacon endpoint for authenticity.
> Source: legacy §7, D2; the server beacon module.

## 9. Ledger format

> *Stub — to be written.* Will specify the entry envelope (`seq`, `ts`, `prevHash`, `type`,
> `payload`, `entryHash`), the chaining rule `entryHash = H(PCJ(seq, ts, prevHash, type,
> payload))`, the entry types (`genesis`, `session.open`, `session.seal`, `baseline.seal`,
> `external.anchor`, `witness.anchor`), and the `session.open`/`session.seal` payloads (including
> the additive, optional witness fields). The Ed25519 key/signature octet encoding (§5.3) is
> pinned here. Source: legacy §8.5; [`ledger.ts`](../packages/core/src/ledger.ts),
> [`types.ts`](../packages/core/src/types.ts). JSON Schemas → [`../schema/`](../schema/).

## 10. Generation and output commitment

> *Stub — to be written.* Will specify one-way isolation (PSI-GEN), fixed-N generation with no
> optional stopping, the streaming Merkle output commitment, checkpoint roots, and
> content-addressed raw-blob persistence (`blob/sha256-<root>.bin…`). Source: legacy §7.1–§7.2,
> D3, D10.

## 11. Experiment kinds

> *Stub — to be written.*
>
> **11.1 Binary micro-PK** — trial = sum of `trialBits` raw bits; tripolar HIGH/LOW/BASELINE;
> fixed N; the `binary-micropk v1` PEAR-anchored defaults. Source: legacy D13, D10.
>
> **11.2 Presentiment (forced-choice precognition)** — the per-trial sequence, the
> future-drand-round target, `derivePresentimentTarget` (`valence = H(B_R ‖ uint32(trialIndex))[0]
> & 1`; image index from a disjoint digest slice), the content-hash-pinned CC0 stimulus corpus,
> the per-trial choice commit/signature, and the `R > R₀` timing rule. Source: legacy §7.5, D14;
> [`precog.ts`](../packages/core/src/precog.ts). Golden vectors (`derivePresentimentTarget`,
> `trialCommit`) → `test-vectors/presentiment.json`.

## 12. Scoring

> *Stub — to be written.*
>
> **12.1 Display statistics (non-authoritative)** — `sessionZ`, `hitRateZ`, Stouffer combination;
> explicitly display-only (§3.2).
>
> **12.2 The psi-score e-value** — the anytime-valid test martingale
> `W = mean_j exp(δ_j·S − n·δ_j²/2)` over the fixed grid `[0.1, 0.2, 0.4, 0.8]`, one-sided;
> decibans `points = 10·log10(W)`; the candidate threshold (`W ≥ 1000` **and** ≥ 5 scored
> sessions). Validity rests on Ville's inequality. Source: legacy D15;
> [`psi.ts`](../packages/core/src/psi.ts). Golden vector (`psiScore([3]) = 3.5496219767564274`) →
> `test-vectors/psi-score.json`.

## 13. Witness protocol

> *Stub — to be written.* Will specify the `witnessStatement` canonical form, the attestation
> object, the M-of-N quorum rule (counting **distinct trusted** keys, trusted set chosen by the
> auditor), what is witnessed per kind, and the trusted-time roots (self-verified drand round +
> RFC 3161 TSA + OTS/Bitcoin). Source: legacy D16, §7.4; [`witness.ts`](../packages/core/src/witness.ts).
> Golden vectors (`witnessStatement`, quorum) → `test-vectors/witness.json`.

## 14. Verification procedure

> *Stub — to be written.* Will specify, as a normative algorithm, the auditor checks of legacy
> §7.3: recompute each pre-commitment and anchor; verify operator and witness signatures and the
> beacon BLS; walk the hash chain and check it against the external anchors; recompute Merkle
> roots over raw blobs; re-derive per-trial targets and re-hash served stimulus bytes; and
> recompute every score. This section defines what a conforming **Verifier** (§16) MUST do.

## 15. Security considerations

> *Stub — to be written.* Will port and formalize the honest residual-trust accounting of legacy
> §7.4: the parallel-runs attack (micro-PK) and choice-timing/backdating (precognition) and how
> witnesses close them; the remaining witness-independence frontier and the role of the external
> time root at N=1; entropy-source integrity as a separate axis; and "published code == running
> code". Per RFC convention this is a required section.

---

## 16. Conformance

This document defines two conformance classes. An implementation MAY satisfy either or both.

- **[PSI-CONF-1] Verifier.** A conforming Verifier MUST perform every check defined as REQUIRED
  in §14 over a supplied ledger and its referenced artifacts, MUST reject any artifact that fails
  any such check, and MUST reproduce every test vector in Appendix A.
- **[PSI-CONF-2] Instrument (generator).** A conforming Instrument MUST emit only artifacts that a
  conforming Verifier accepts; MUST encode all hashed/signed data as PCJ (§4); MUST construct
  commitments, Merkle roots, and signatures per §5–§13; and MUST reproduce every test vector in
  Appendix A.
- **[PSI-CONF-3]** An implementation claiming conformance MUST state the protocol **version**
  (README) it conforms to. Conformance is defined per version: it requires satisfying every
  MUST/SHALL of that version and reproducing every test vector shipped with that version.

The reference Verifier is [`analysis/analyze.py`](../analysis/analyze.py) plus the in-browser
verifier; the reference Instrument is the `packages/server` + `packages/core` stack. Neither is
privileged: a result is credible precisely because *independent* implementations of these classes
agree on the same public ledger.

---

## 17. References

### 17.1 Normative references

- **[RFC 2119]** Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119.
- **[RFC 8174]** Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174.
- **[RFC 8259]** Bray, T., Ed., "The JavaScript Object Notation (JSON) Data Interchange Format", RFC 8259.
- **[RFC 8785]** Rundgren, A., Jordan, B., Erdtman, S., "JSON Canonicalization Scheme (JCS)", RFC 8785.
- **[RFC 8032]** Josefsson, S., Liusvaara, I., "Edwards-Curve Digital Signature Algorithm (EdDSA)", RFC 8032.
- **[FIPS 180-4]** NIST, "Secure Hash Standard (SHS)", FIPS PUB 180-4.
- **[RFC 3161]** Adams, C., et al., "Internet X.509 PKI Time-Stamp Protocol (TSP)", RFC 3161. *(witness time root, §13)*

### 17.2 Informative references

- **drand / League of Entropy** — the public randomness beacon (quicknet); BLS signatures over `H(round)`. *(§8)*
- **OpenTimestamps** — Bitcoin-anchored timestamping. *(§13)*
- **[RFC 6234]** Eastlake & Hansen, "US Secure Hash Algorithms" — additional SHA test vectors.
- **Ville's inequality / test martingales** — the anytime-valid basis of the psi score (§12); see Ramdas et al., "Game-theoretic statistics and safe anytime-valid inference".
- **I. J. Good**, "Weight of evidence" — the deciban scoring of the psi score (§12).
- **PEAR**, **Global Consciousness Project**, and **Bösch, Steinkamp & Boller (2006)** — prior art and the meta-analytic critiques the methodology pre-empts (see `RATIONALE.md`).

---

## Appendix A. Test vectors

Normative known-answer vectors live in [`test-vectors/`](test-vectors/) as JSON, so they can be
loaded by implementations in any language. A conforming implementation (§16) MUST reproduce them.
They are designed to be loaded as the shared fixtures of both the TypeScript core tests and
`analysis/analyze.py`; wiring them in (replacing today's inline golden literals) is how
cross-language byte-parity (G6) becomes a CI gate.

| File | Covers | Status |
|---|---|---|
| [`canonicalization.json`](test-vectors/canonicalization.json) | §4 | present |
| [`primitives.json`](test-vectors/primitives.json) | §5 | present |
| [`experiment.json`](test-vectors/experiment.json) | §6 | present |
| [`precommit.json`](test-vectors/precommit.json) | §7 | present |
| `presentiment.json` | §11.2 | planned |
| `psi-score.json` | §12 | planned |
| `witness.json` | §13 | planned |

## Appendix B. Design rationale

The reasoning behind every decision — the D1–D16 decision log, the threat model, and the
residual-trust accounting — is the informative companion [`RATIONALE.md`](RATIONALE.md). It is
deliberately separate so that this document states *what* a conforming implementation does, while
the rationale records *why*.

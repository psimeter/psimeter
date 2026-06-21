# PsiMeter Specification

This directory is the **normative specification** of the PsiMeter protocol — the single
source of truth from which the implementation, the analysis pipeline, and the documentation
wiki are derived, and against which any *independent* implementation can be checked.

PsiMeter's foundational axiom is that **the experimenter is an untrusted party**: a skeptic
must be able to verify every published result from public artifacts without trusting the
operator's server — *or its code*. The logical endpoint of that axiom is **implementation
independence**: anyone can build their own verifier (or their own generator) from this
document and check the published ledger for themselves. This specification exists to make
that possible.

## Document set

| File | Status | Contents |
|------|--------|----------|
| [`psimeter-protocol.md`](psimeter-protocol.md) | **Normative** | The protocol: canonicalization, cryptographic primitives, pre-commitment, beacon binding, ledger format, experiment kinds, scoring, the witness protocol, and the verification procedure. |
| [`RATIONALE.md`](RATIONALE.md) | Informative | *Why* it is built this way — the design pillars, the two hypotheses, the **decision log (D1–D16)**, the threat model, and the residual-trust accounting. The former `docs/SPECIFICATION.md`, verbatim. |
| [`test-vectors/`](test-vectors/) | **Normative** | Machine-readable known-answer vectors. A conforming implementation MUST reproduce them. Loaded as the shared fixtures of both the `packages/core` test suite and `analysis/analyze.py --check-vectors`, so CI fails if either drifts. |
| [`../schema/`](../schema/) | **Normative** | JSON Schemas for ledger entries and experiment definitions. |

## Conventions

- **Requirement keywords.** The key words "MUST", "MUST NOT", "REQUIRED", "SHALL",
  "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL"
  in the specification are to be interpreted as described in BCP 14
  ([RFC 2119](https://www.rfc-editor.org/info/rfc2119),
  [RFC 8174](https://www.rfc-editor.org/info/rfc8174)) when, and only when, they appear in all
  capitals, as shown here.
- **Normative vs informative.** Sections marked *Informative* (and the entire companion
  `RATIONALE.md`) explain intent and carry no conformance weight. Everything else is normative.
- **Requirement identifiers.** Each normative requirement carries a stable identifier of the
  form `[PSI-<AREA>-<n>]` (for example `[PSI-CANON-3]`). These identifiers are **permanent**:
  code comments, tests, and the wiki cite them, and they are the mechanism that binds the
  implementation to the spec. A requirement is never renumbered; if it is withdrawn its
  identifier is retired, not reused.

## Versioning & conformance

- This document is currently a **draft** (`0.1.0-draft`). Until a version is released, anything
  may change without notice.
- A **released** version is immutable, mirroring the experiment-definition discipline (D13): any
  change to a normative requirement or to a test vector **bumps the version**. This is what lets
  a published result cite *"verified against PsiMeter Protocol vX"* unambiguously.
- An implementation **conforms to version X** if and only if it satisfies every MUST/SHALL in
  version X **and** reproduces every test vector shipped with version X. Conformance is therefore
  *mechanically checkable*, not a claim.

## How this is the single source of truth

A prose document cannot generate code — but the dependency is made mechanical:

1. Normative requirements have **stable IDs** cited from code and tests (grep works both ways).
2. The **test vectors** are the cross-language contract: the TypeScript core test suite and the
   Python verifier (`analyze.py --check-vectors`) both load them as fixtures, so CI fails if either
   drifts from the frozen values. This is the byte-parity guard the project treats as sacred.
3. The **JSON Schemas** validate real ledger artifacts in CI.
4. The **wiki** (`packages/client` `/docs`) and the implementation cite section and requirement
   numbers rather than restating the rules.

## What this is *not*

This is a **self-published** specification that deliberately adopts the conventions and rigor of
IETF RFCs (BCP 14 keywords, normative/informative separation, a Security Considerations section,
test vectors). It is **not** an IETF product and has not been through the IETF process.

The **scientific** claims — the hypotheses, the pre-registered analysis, the stopping rules — are
deliberately *not* specified here; they belong in a pre-registration (e.g. OSF). This document
governs the **protocol, data formats, cryptography, and verification** that make those claims
auditable by anyone.

## License

The **specification text** in this directory (`*.md`) is licensed **CC BY 4.0** — anyone may build
their own implementation and redistribute or adapt the spec with attribution, which is the point.
The **reference code** in the repository remains **MIT**. The machine-readable test vectors
(`test-vectors/`) are released as part of the specification.

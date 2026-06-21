# PsiMeter specification — moved

This document has been split and moved into the [`spec/`](../spec/) directory, which is now the
single source of truth:

- **Normative protocol** — [`spec/psimeter-protocol.md`](../spec/psimeter-protocol.md): the
  canonical data formats, cryptographic primitives, pre-commitment, ledger, experiment kinds,
  scoring, witness protocol, and verification procedure. RFC-style, with stable `PSI-*` requirement
  IDs and machine-checked [test vectors](../spec/test-vectors/).
- **Design rationale & decision log** — [`spec/RATIONALE.md`](../spec/RATIONALE.md): the design
  pillars, the two hypotheses, the **decision log (D1–D16)**, the threat model, and the original
  design narrative (this is the former content of this file, verbatim).
- **Document set & conventions** — [`spec/README.md`](../spec/README.md).

Older `§`-number references elsewhere in the codebase that point at "docs/SPECIFICATION.md §N" refer
to the legacy numbering, now preserved in [`spec/RATIONALE.md`](../spec/RATIONALE.md).

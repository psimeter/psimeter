# schema/

Cross-language data contracts for the ledger, experiment definitions, and
commitments.

The **normative** definitions of these formats live in the specification
([`spec/psimeter-protocol.md`](../spec/psimeter-protocol.md) — §6 experiment definitions, §9 ledger);
[`packages/core/src/types.ts`](../packages/core/src/types.ts) is the implementing source. Standalone
JSON Schemas — consumable by the Python analysis pipeline and any third-party auditor's tooling — will
be generated and published here before confirmatory data collection, validated against the spec's
[test vectors](../spec/test-vectors/).

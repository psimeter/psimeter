# schema/

Cross-language data contracts for the ledger, experiment definitions, and
commitments.

For Phase 1 the **source of truth is [`packages/core/src/types.ts`](../packages/core/src/types.ts)**
(plus the `*.ts` modules that build on it). Standalone JSON Schemas — consumable
by the Python analysis pipeline and any third-party auditor's tooling — will be
generated from these types and published here before confirmatory data collection.

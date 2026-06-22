# schema/examples/

Committed example ledger entries used by [`../check.py`](../check.py) to exercise the payload shapes
the real, un-witnessed dev artifacts (and the minimal `spec/test-vectors/ledger.json` fixture) don't
cover: a **witnessed** micro-PK seal, and a **precognition** open/seal.

These are **structural fixtures**: their field *formats* are faithful to the spec and the
implementation (`packages/server/src/session.ts`, `kinds/microPk.ts`, `kinds/precog.ts`), and they
validate against [`../ledger-entry.schema.json`](../ledger-entry.schema.json). They are **not** a
verifiable hash-chain — the hash/key/signature values are illustrative, chosen only to satisfy the
schemas' patterns, and the `entryHash`/`prevHash` links are not real. The micro-PK seal reuses the
genuine commitment values from a real dev session and adds the additive witness block + a checkpoint.

For authoritative known-answer values (real digests an auditor recomputes), see
[`../../spec/test-vectors/`](../../spec/test-vectors).

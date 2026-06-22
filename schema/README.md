# schema/

Standalone **JSON Schemas** (Draft 2020-12) for PsiMeter's published data contracts —
consumable by the Python analysis pipeline and any third-party auditor's tooling.

The **normative** definitions of these formats live in the specification
([`spec/psimeter-protocol.md`](../spec/psimeter-protocol.md) — §6 experiment definitions, §9 ledger,
§13 witnesses); [`packages/core/src/types.ts`](../packages/core/src/types.ts) is the implementing
source. **On any conflict the spec wins**; these schemas are a faithful, machine-checkable restatement
of the same `[PSI-*]` requirements, not an independent authority.

## Files

| Schema | Covers | Spec |
|---|---|---|
| [`common.schema.json`](common.schema.json) | shared `$defs`: hash/anchor/key/sig/hex strings, `beaconRef`, `entropySource`, witness attestation/block/checkpoint, and the recursive `committableValue` | §5, §7.2, §8.1, §13 |
| [`experiment-definition.schema.json`](experiment-definition.schema.json) | a versioned, content-addressed `ExperimentDefinition` | §6 |
| [`session-open.schema.json`](session-open.schema.json) | the `session.open` ledger payload | §9.4 |
| [`session-seal.schema.json`](session-seal.schema.json) | the `session.seal` ledger payload (both kinds; incl. optional witness fields) | §9.4, §11, §13 |
| [`ledger-entry.schema.json`](ledger-entry.schema.json) | the ledger entry envelope; dispatches `payload` by `type` | §9.1 |

`$id` values are **relative filenames**, so cross-file `$ref`s (e.g.
`common.schema.json#/$defs/hashString`) resolve from this directory.

## Design decisions (read before tightening anything)

- **The `ExperimentDefinition` is intentionally open.** Per [PSI-EXP-4] the format may grow without
  invalidating sealed sessions — the published `precognition-presentiment` definition already carries
  a `contentWarning` beyond `types.ts`. So the schema permits additional top-level members, but every
  value (in `params`, `stimuli`, and any extra member) must be a `committableValue` — strings and safe
  integers nested in arrays/objects only ([PSI-EXP-2], §4). Floats, booleans, and nulls are rejected,
  because the definition is hashed (`experimentHash = H(PCJ(definition))`) and must be byte-portable.
- **Ledger payloads are closed (`additionalProperties: false`).** `session.open`/`session.seal` have
  exactly the members §9.4 enumerates. Strictness is a feature here: it catches typos and stray fields,
  and enforces [PSI-LEDGER-5] (no derived real-valued statistic — e.g. a z-score — may be stored; only
  the integer counts `ones`/`nSamples` or `hits`/`trials`). The witness fields (`witnessed`, `witness`,
  `checkpoints`) are **enumerated optionals**: absent ⇒ byte-identical to a pre-witness seal (§13).
- **`session.seal` is a `oneOf` of two disjoint shapes** — micro-PK (`leafBytes`/`nSamples`/`ones`) and
  precognition (`trials`/`hits`/`optionsPerTrial`). The required-key sets plus `additionalProperties:
  false` make the branches mutually exclusive, so exactly one matches.
- **The envelope dispatches `payload` by `type`.** `session.open` and `session.seal` are constrained to
  their payload schemas; the other entry types (`genesis`, `baseline.seal`, `external.anchor`,
  `witness.anchor`) currently accept any object — they are out of scope of this schema set.
  `witness.attest` lives only in the sibling witness feed (§13), never the main ledger.
- **`kind` is enumerated** to the two registered kinds (§11). A new kind requires a spec update and a
  schema bump — by design, so the registry can't silently grow.

## Validating

```
npm run schema:check          # or: python schema/check.py
```

[`check.py`](check.py) carries a tiny, self-contained Draft 2020-12 validator (the subset these
schemas use) so it runs on a bare Python install — matching the standard-library-only ethos of
[`analysis/analyze.py`](../analysis/analyze.py); `jsonschema`/`ajv` are deliberately not dependencies.
It validates, against the schemas:

- the experiment-definition vectors ([`spec/test-vectors/experiment.json`](../spec/test-vectors/experiment.json))
  and both published definitions ([`experiments/*.json`](../experiments));
- the ledger chain vector ([`spec/test-vectors/ledger.json`](../spec/test-vectors/ledger.json)) at the
  envelope level — that fixture's payloads are deliberately abbreviated to test hashing/linkage, so it
  is checked against the envelope without the per-type payload dispatch;
- the committed [`examples/`](examples) entries — which exercise the witnessed micro-PK seal and the
  precognition open/seal shapes that the un-witnessed dev artifacts don't;
- the local dev ledger (`ledger/*.jsonl`) if present (git-ignored, optional).

It then asserts a set of **negative** cases are rejected (float param, missing vocabulary, unknown
kind, missing/stray payload member, malformed hash, a stored z-score, a kind-mixing seal).

The authoritative cross-language conformance gate remains the test vectors loaded by **both** the core
test suite (`npm test`) and `python analysis/analyze.py --check-vectors`; these schemas are a
complementary structural contract, not a replacement for it.

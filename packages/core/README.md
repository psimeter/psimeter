# @psymeter/core

The auditable cryptographic heart of PsyMeter. **Pure and I/O-free** so the
correctness-critical logic can be reviewed and tested in isolation.

| Module | Responsibility |
|---|---|
| `canonicalize` | Deterministic, cross-language JSON form for hashing/signing |
| `hash` | Prefixed SHA-256 helpers |
| `merkle` | Streaming, domain-separated Merkle commitment over the raw stream |
| `experiment` | Versioned, content-addressed experiment definitions (D13) |
| `commitment` | Pre-commitment + human "anchor" derivation (§7.2) |
| `ledger` | Immutable, hash-chained ledger entries + integrity verification (§8.5) |
| `scoring` | Binomial z / Stouffer combination — **display only**, not authoritative |

```bash
npm --workspace @psymeter/core test   # compiles, then runs node:test
```

The canonical form here is mirrored byte-for-byte by `analysis/analyze.py`, which
re-verifies the ledger independently — see docs/SPECIFICATION.md §8.1.

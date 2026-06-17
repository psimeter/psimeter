# analysis/

The **authoritative** statistics live here — computed deterministically over the
*published* ledger, never by the live server (spec §8.1). Keeping analysis in a
separate, open Python package is what lets any third party reproduce every number.

```bash
python analyze.py ../ledger/dev.jsonl     # verify the chain + score sessions
```

`analyze.py` deliberately re-implements the canonical hashing in plain Python so
that re-deriving a matching `entryHash` is an independent confirmation that the
TypeScript collector did not alter anything — the cross-language check at the
heart of "don't trust the experimenter."

**Roadmap (pre-registered before confirmatory data):** calibrated-null comparison
against operator-absent baselines (D5), HIGH−LOW contrast, variance-inflation and
tail-excess tests (H2), per-operator split-half / test–retest reliability and the
leave-one-operator-out robustness check (H1).

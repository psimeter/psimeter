# PsiMeter

An open-source platform for large-scale, anonymous, web-based experiments that test
for putative **psi** effects — whether a human observer can, by intention alone,
bias a *live physical* random process (micro-psychokinesis), or anticipate a future
random outcome better than chance (precognition).

> **Status:** Phase 1 scaffold. The methodology is specified in
> [`spec/psimeter-protocol.md`](spec/psimeter-protocol.md) (with the rationale and decision log in
> [`spec/RATIONALE.md`](spec/RATIONALE.md)); this repository contains the auditable cryptographic
> core, a raw-entropy sidecar, and the surrounding skeleton.

## The one thing to understand first

The whole design treats **the experimenter as an untrusted party**. You should not
have to trust whoever runs the server. Trust divides into two paths:

- **Integrity** (capture → commit → sign → hash-chain → log) is *cryptographic* and
  verified by re-computation from public artifacts. It is language-independent.
- **Statistics** are produced **only** by the open, deterministic Python pipeline in
  [`analysis/`](analysis/), run over the *published raw data*. The live server's
  on-screen "sigma" is display-only.

Because the backend lives only in the integrity path, the choice of backend language
carries no scientific risk. See [`spec/psimeter-protocol.md`](spec/psimeter-protocol.md) §3 (architecture & trust model).

## Repository layout

```
spec/                 normative protocol spec + rationale (decision log D1–D16) + test vectors
docs/                 pointer to spec/ (legacy path)
schema/               cross-language data contracts (core/src/types.ts is current SoT)
packages/
  core/               TS, pure & I/O-free: commitments, Merkle, ledger, canonicalization
  server/             TS: HTTP + one-way WebSocket, session orchestration, generation loop
  entropy-provider/   Rust: raw-bytes sidecar (RDSEED) — the only systems-level code
  client/             three.js operator UI (stub)
analysis/             Python: deterministic statistics over the published ledger
experiments/          versioned, immutable experiment definitions (hash-bound, D13)
ledger/               local dev output (git-ignored)
```

## Prerequisites

- Node.js ≥ 20 and npm
- Rust toolchain (for the entropy sidecar; only needed to run on real physical entropy)
- Python ≥ 3.11 (the core analysis checks use the standard library only)

## Quickstart

```bash
npm install                 # install workspace dev dependencies
npm test                    # build + unit-test the cryptographic core
npm run build:core          # the server imports the built core

# real physical entropy (pilot-grade): build the RDSEED sidecar so the server
# uses it automatically (falls back to the NON-confirmatory OS source otherwise)
cargo build --release --manifest-path packages/entropy-provider/Cargo.toml

# run the server, then open http://localhost:8787 and run a session in the browser
npm start

# verify & score the ledger independently from Python: chain integrity, raw-blob
# round-trip (flat SHA-256 + Merkle), per-intention scoring, external anchors
python analysis/analyze.py ledger/dev.jsonl

# after a batch of sessions, anchor the ledger head and publish the receipt
npm run anchor
```

Headless transport check (no browser): `PSIMETER_FAST=1 PSIMETER_ENTROPY=os npm run smoke`.

## Entropy sources (spec D1)

| Source | Physical? | Use |
|---|---|---|
| `os` (node:crypto) | No — CSPRNG | CI / plumbing only, **never** scientific data |
| `rdseed` (CPU) | Yes, thermal noise | local self-testing / pilots (whitened, vendor-opaque) |
| open-hardware USB TRNG | Yes | auditable early data collection |
| quantum RNG | Yes | confirmatory flagship (later) |

## License

Code: [MIT](LICENSE). The eventual public dataset will carry an open data license
(CC0 or CC-BY) — see spec D7.

# PsyMeter — project context

PsyMeter is an open-source platform for large-scale, anonymous, web-based experiments
testing for putative **"psi"** effects (micro-psychokinesis on a *true* RNG; forced-choice
precognition). It has **two equally important parts**:

1. **The scientific instrument** — rigorous, fraud-resistant, auditable methodology (Phase 0–1, done).
2. **A public-facing, gamified website** — that strangers worldwide will actually use (Phase 2, next).

The owner is also a test subject (a putative RNG-influencer) and wants to prove **or** disprove,
at scale, on no budget. Be outcome-neutral and supportive; the rigor protects against self-deception.

## The one non-negotiable
**Treat the experimenter/server as an UNTRUSTED party.** A skeptic must verify every result from
public artifacts without trusting anyone. This drives the entire cryptographic design.

## Authoritative docs — read first
- `docs/SPECIFICATION.md` — the living spec. Key parts: design pillars (§2), glossary (§3),
  **two hypotheses H1/H2 (§5)**, **decision log D1–D13 (§6)**, **provenance flow (§7, status in §7.6)**,
  **architecture (§8)**, phasing (§9), **public website plan (§10)**. Keep it updated as decisions land.
- Auto-loaded memory: project overview, owner-is-subject, Phase 2 website plan.

## Status — Phase 0–1 COMPLETE (verified, committed)
- **Methodology locked (D1–D13):** true-physical RNG; tripolar HIGH/LOW/BASELINE; fixed-N, no optional
  stopping; pre-registration; calibrated baseline; versioned + hash-bound experiment params (PEAR-anchored).
- **Cryptographic core** (`packages/core`, TS, pure/IO-free): canonicalization (RFC 8785 subset),
  SHA-256, domain-separated Merkle, commitments + human **anchor**, hash-chained ledger, scoring. `npm test`.
- **Full provenance spine:** operator **Ed25519 signing** → live **drand** beacon → **one-way** generation
  with streaming **Merkle** → **raw-blob persistence** (content-addressed) → **hash-chained ledger** →
  **external-anchor receipts**. All independently re-verifiable by `analysis/analyze.py` (Python, stdlib).
- **Transport + client:** HTTP + one-way WebSocket; three.js cumulative-deviation feed
  (functional but **un-gamified stub — to be rebuilt as the public site in Phase 2**).
- **Entropy ladder:** `os` (non-confirmatory plumbing) · **`rdseed`** (real physical, pilot-grade,
  auto-selected when the Rust sidecar is built) · future open-hardware TRNG → QRNG (confirmatory).

## Repo layout (npm workspaces + Rust + Python)
- `packages/core` — TS, the auditable crypto core (pure, exhaustively unit-tested).
- `packages/server` — TS, HTTP + WS, session orchestration, generation loop, ledger, beacon, anchoring.
- `packages/entropy-provider` — Rust, zero-dep RDSEED sidecar (raw, unconditioned bytes).
- `packages/client` — three.js operator UI (Phase-2 rebuild target).
- `analysis` — Python, independent ledger verification + intention-aware scoring.
- `experiments` — versioned, hash-bound experiment definitions (`<id>-v<n>.json`).
- `ledger` — local dev output (git-ignored): `*.jsonl`, `blobs/`, `anchor-receipts.jsonl`.

## Commands
```
npm install                  # workspaces
npm test                     # build + unit-test core (node:test, no extra deps)
npm run build:core           # build core (server imports the built dist)
cargo build --release --manifest-path packages/entropy-provider/Cargo.toml   # RDSEED sidecar
npm start                    # server at http://localhost:8787 (auto: RDSEED + drand)
npm run smoke                # headless transport + signing test (use PSYMETER_FAST=1)
npm run anchor               # anchor ledger head + emit a publishable receipt
python analysis/analyze.py ledger/<file>.jsonl   # independent verify + score
```
Env knobs: `PSYMETER_ENTROPY=os|rdseed` · `PSYMETER_BEACON=drand|dev` · `PSYMETER_LEDGER=<path>` ·
`PSYMETER_PORT` · `PSYMETER_FAST=1` (skip the 3-min human pacing).

## Conventions & gotchas
- TS strict, NodeNext ESM (`.js` import specifiers). Core is tested with `node --test` on compiled JS
  (zero test deps). Server/client dev via `tsx`.
- **Cross-language hash parity is sacred:** `packages/core/src/canonicalize.ts` and the canonical form in
  `analysis/analyze.py` MUST stay byte-identical (sorted keys, compact separators, **integers/strings only —
  NO floats**; z-scores are display-only and derived in analysis). The Python Merkle in `analyze.py` mirrors
  `merkle.ts` (leaf `0x00`, node `0x01`).
- **The leaderboard is NOT evidence** (multiple comparisons); the science is the pre-registered aggregate (D4).
  A single session has ~no power (D13).
- **Windows / PowerShell:** commit messages with embedded double-quotes break native-arg quoting, and piping to
  `git commit -F -` prepends a UTF-8 BOM. Pass `-m` with a single-quoted here-string that has **no double-quotes**.
- Commit only when asked; branch off `main` for non-trivial work; end commit messages with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Phase 2 (next) — see SPECIFICATION.md §10
**Public website** (rebuild `packages/client`): (1) About / how-it-works (skeptic-accessible, explains the
cryptographic auditability); (2) Experiments browser with stats + per-experiment pages + **per-user history tied
to the browser Ed25519 key**; (3) Leaderboard / aggregate view (honest, vs calibrated null); (4) **Gamified
experiment UI with the anchor shown large and central** as the ESP focal point — "beat the game" framing over
faithful participation. Plus: the **precognition** experiment (§7.5), per-operator H1 analysis, and the §7.6
residual hardening (BLS verify of drand; Ed25519 verify in `analyze.py`; vendor CDN deps with SRI; automated
anchoring; live witnesses).

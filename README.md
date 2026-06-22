<p align="center">
  <img src="https://psimeter.org/psi_logo.png" alt="PsiMeter logo" width="150" />
</p>

<h1 align="center">PsiMeter</h1>

<p align="center">
  <strong>Can human intention influence a true random number generator?<br />
  Can people anticipate future random outcomes better than chance?</strong>
</p>

<p align="center">
  →&nbsp;<a href="https://psimeter.org"><strong>psimeter.org</strong></a>&nbsp;·
  <a href="https://github.com/psimeter/psimeter">github.com/psimeter/psimeter</a>&nbsp;·
  <a href="https://opencollective.com/psimeter">Support the project</a>
</p>

---

These are real scientific questions — and PsiMeter is built to answer them properly. It is an open-source platform for running large-scale, anonymous, web-based experiments that test for putative psi effects, designed from the ground up so that neither the experimenter nor anyone else has to be trusted.

---

## Why this is different from prior research

Most psi research is easy to dismiss — not because the question is stupid, but because the methodology is. Optional stopping (keep running until the numbers look good), experimenter bias, no independent verification: these are the reasons the scientific community doesn't take this field seriously.

PsiMeter is built around a single axiom: **the experimenter is untrusted.** You should not have to trust whoever runs the server, and you don't have to. Every experiment result is:

- **Cryptographically pre-committed** — the operator's decision is locked in before any randomness exists
- **Signed and hash-chained** — nothing can be silently altered, reordered, or backdated
- **Independently verifiable** — anyone can re-check every published result from public artifacts alone, using the open Python verifier, without trusting this code or this server

A skeptic with a laptop can audit the entire corpus. A null result is as valuable as a positive one. That's the point.

---

## The two experiments

### Micro-psychokinesis (micro-PK)
You declare your intention — *High*, *Low*, or *Baseline* — before the experiment begins. A live physical random number generator (CPU hardware entropy, thermal noise) then produces a fixed stream of bits. Did the bit counts deviate in your declared direction? The generator runs in one-way isolation: it reads nothing from you during the session. Your decision is committed before a single bit is produced.

### Precognition / Presentiment
You predict the emotional valence of an image — *calm* or *aversive* — before the image exists. The target is derived entirely from a future public randomness beacon that neither you nor the server can predict. Your prediction is cryptographically committed before that beacon round is published. Did you do better than chance?

---

## How the verification works (no cryptography required to understand this)

Before each session, a hash — a short fingerprint — is computed over your declared intention, the experiment parameters, and a live public randomness pulse. This fingerprint is shown to you as a human-readable **anchor** (e.g. `P8KH-AF4S-EM8E`). Write it down.

After the session, all the raw data is published: the random bits, the anchor, the cryptographic chain linking everything together. Anyone can recompute the fingerprint from scratch and confirm it matches. Anyone can re-run the statistics over the raw data. The server's role is to produce and publish artifacts — not to be trusted.

The full technical specification is in [`spec/psimeter-protocol.md`](spec/psimeter-protocol.md).

---

## Support the project

PsiMeter is independent, open-source, and runs on no budget. If you find this work interesting — whether you're a believer, a skeptic, or just scientifically curious — you can support it at:

**[opencollective.com/psimeter](https://opencollective.com/psimeter)**

All funds go toward hosting infrastructure and development. Financial activity is fully public.

---

## Contribute

There are several ways to contribute beyond funding:

- **Run an independent verifier.** The protocol is fully specified in [`spec/psimeter-protocol.md`](spec/psimeter-protocol.md). Build your own verifier in any language and check it against the published test vectors. Independent implementations agreeing on the same ledger is the strongest possible credibility signal.
- **Run an independent witness node.** The witness protocol (§13 of the spec) allows independent processes to co-sign experiment artifacts in real time. The more independent witnesses, the stronger the guarantees.
- **Contribute code.** See the repo layout below. The cryptographic core (`packages/core`) is pure TypeScript with exhaustive unit tests — a good place to start.
- **Spread the word.** Share the project with researchers, skeptics, and science communicators. The experiment only works at scale.

---

## Repository layout

```
spec/                 normative protocol spec + rationale (decision log D1–D16) + test vectors
docs/                 pointer to spec/ (legacy path)
schema/               cross-language data contracts
packages/
  core/               TS, pure & I/O-free: commitments, Merkle, ledger, canonicalization
  server/             TS: HTTP + one-way WebSocket, session orchestration, generation loop
  entropy-provider/   Rust: raw-bytes sidecar (RDSEED) — the only systems-level code
  client/             three.js operator UI (Phase 2 rebuild in progress)
analysis/             Python: deterministic statistics over the published ledger
experiments/          versioned, immutable experiment definitions (hash-bound)
ledger/               local dev output (git-ignored)
```

---

## Quickstart (for developers)

**Prerequisites:** Node.js ≥ 20, npm, Python ≥ 3.11, Rust toolchain (optional, for physical entropy)

```bash
npm install                 # install workspace dependencies
npm test                    # build + unit-test the cryptographic core
npm run build:core          # the server imports the built core

# optional: build the RDSEED entropy sidecar for real physical entropy
cargo build --release --manifest-path packages/entropy-provider/Cargo.toml

# run the server, then open http://localhost:8787
npm start

# independently verify and score a ledger
python analysis/analyze.py ledger/dev.jsonl

# anchor the ledger head and publish a receipt
npm run anchor
```

Headless smoke test: `PSIMETER_FAST=1 PSIMETER_ENTROPY=os npm run smoke`

---

## Entropy sources

| Source | Physical? | Use |
|--------|-----------|-----|
| `os` (node:crypto) | No — CSPRNG | CI / plumbing only, **never** scientific data |
| `rdseed` (CPU) | Yes, thermal noise | Local testing / pilots |
| Open-hardware USB TRNG | Yes | Auditable early data collection |
| Quantum RNG | Yes | Confirmatory flagship (planned) |

---

## License

Code: [MIT](LICENSE) · Protocol specification: [CC BY 4.0](spec/psimeter-protocol.md) · Dataset (when published): CC0 or CC-BY

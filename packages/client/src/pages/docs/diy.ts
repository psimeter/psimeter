// Verify & run it yourself: in-browser + offline verification (§7.3), the full
// self-host / witness-node / scripts story, and the architecture (§8).

import type { Child } from '../../ui';
import { P } from './paths';
import { h2, p, lead, b, em, code, pre, ul, ol, link, callout, defs } from './prose';

export function renderVerify(): Child[] {
  return [
    lead(
      'Don’t take our word for anything. There are two independent ways to verify any result, neither of which trusts the live server — one in your browser in a few seconds, one offline against the raw ledger.',
    ),

    h2('browser', 'In the browser'),
    p(
      'Open any session’s ', link('/verify', 'verification view'),
      '. It runs entirely client-side: it recomputes the pre-commitment and anchor from the revealed fields and checks the operator’s Ed25519 signature, all in pure JavaScript (the core’s hashing was moved to ',
      code('@noble/hashes'),
      ' precisely so the same byte-exact code runs in the page and in Node).',
    ),
    p('For a presentiment session it goes further, re-running the whole chain per trial:'),
    pre('beacon B_R  →  committed image hash  →  re-hashed actual pixels  →  valence  →  hit'),
    p('— re-deriving each ', code('{valence, image}'), ' from B_R, confirming the shown image against the committed manifest, fetching and re-hashing the actual served pixels, and checking each signature and the timing ordering ', code('R > R₀'), '.'),

    h2('offline', 'Offline, with analyze.py'),
    p('The full, independent verifier is a single Python script that uses only the standard library (plus optional ', code('cryptography'), ' for signature checks):'),
    pre('python analysis/analyze.py ledger/<file>.jsonl'),
    p('It re-derives everything the protocol claims, byte-for-byte:'),
    ol([
      ['recomputes each pre-commitment and anchor;'],
      ['verifies the operator Ed25519 signatures and the drand beacon (BLS);'],
      ['re-walks the hash chain and checks it against the external anchors;'],
      ['recomputes the Merkle roots over the raw blobs;'],
      ['re-checks the ', link(P.witnesses, 'witness'), ' attestations and their round/TSA ordering;'],
      ['recomputes every score, including the ', link(P.psiScore, 'psi-score'), ' wealth (guarded by a frozen golden vector against the TypeScript core).'],
    ]),
    callout(
      'The two paths exist on purpose: the browser view is the convenient spot-check, ', code('analyze.py'),
      ' is the authoritative re-computation. Both implement the ', link(P.crypto, 'same primitives'),
      ' independently of the server — that is the whole point of the ', link(P.principle, 'untrusted-experimenter'), ' design.',
    ),
  ];
}

export function renderRun(): Child[] {
  return [
    lead(
      'PsiMeter is MIT-licensed and runs locally with no cloud and no budget. This is the practical guide to standing up the instrument, generating real physical entropy, running a witness node, and re-verifying data — everything you need to corroborate results yourself.',
    ),

    h2('prereqs', 'Prerequisites'),
    ul([
      [b('Node.js + npm '), '(the monorepo is npm workspaces).'],
      [b('Rust + Cargo '), '— optional, only to build the RDSEED entropy sidecar for real physical randomness.'],
      [b('Python 3 '), '— for ', code('analyze.py'), '; the standard library is enough, with optional ', code('cryptography'), ' for signature verification.'],
      [b('openssl / ots '), '— optional, for full TSA token and OpenTimestamps verification.'],
    ]),

    h2('install', 'Install, build, test'),
    pre(
`npm install            # install all workspaces
npm run build:core     # build the auditable crypto core (server imports the built dist)
npm test               # build + unit-test core (node:test, zero extra deps)`,
    ),

    h2('entropy-sidecar', 'Build the real-entropy sidecar (optional)'),
    p('Build the zero-dependency Rust RDSEED provider; once present, the server auto-selects real physical entropy (', link(P.entropy, 'why this matters'), '):'),
    pre('cargo build --release --manifest-path packages/entropy-provider/Cargo.toml'),

    h2('server', 'Run the instrument'),
    pre('npm start              # server at http://localhost:8787 (auto: RDSEED + drand)'),
    p('Behaviour is controlled by environment variables:'),
    defs([
      [code('PSIMETER_ENTROPY'), ['os | rdseed — entropy source (', link(P.entropy, 'the ladder'), ').']],
      [code('PSIMETER_BEACON'), ['drand | dev — the ', link(P.crypto, 'public beacon'), '.']],
      [code('PSIMETER_LEDGER'), ['path to the ledger output directory.']],
      [code('PSIMETER_PORT'), ['the HTTP/WS port (default 8787).']],
      [code('PSIMETER_FAST'), ['1 — skip the ~3-minute human-pacing delay (for smoke tests).']],
    ]),

    h2('client-dev', 'Develop the website'),
    pre(
`npm run dev:client     # hot-reload client; proxies /api to the instrument
npm run build:client   # production bundle (with Subresource-Integrity pinning)
npm run typecheck:client`,
    ),

    h2('witness-node', 'Run a witness node'),
    p(
      'Anyone can run an independent ', link(P.witnesses, 'witness'),
      '. The more independent operators run one, the stronger the guarantee. Start a node (default port 8788):',
    ),
    pre('npm run witness'),
    p('Point the server at one or more witnesses and set a quorum:'),
    pre(
`# on the server:
PSIMETER_WITNESS=http://localhost:8788    # comma-separate multiple URLs
PSIMETER_WITNESS_THRESHOLD=1              # M-of-N quorum required

# on the witness node:
PSIMETER_WITNESS_PORT=8788
PSIMETER_WITNESS_KEY=<ed25519 key>        # the node's signing identity
PSIMETER_WITNESS_FEED=<feed path>         # its append-only hash-chained feed
PSIMETER_TSA_URL=<rfc3161 TSA>            # free, configurable time-stamp authority`,
    ),
    p('Sessions with no co-signature seal ', code('witnessed:false'), ' and are never pooled with witnessed confirmatory data.'),

    h2('scripts', 'Corroborate, anchor, and reset'),
    pre(
`npm run smoke          # headless transport + signing test (use PSIMETER_FAST=1)
npm run smoke:witness  # headless witnessed end-to-end test (spawns witness + server)
npm run anchor         # anchor the ledger head → publishable OpenTimestamps receipt
npm run purge          # wipe local dev ledger output (keeps .gitkeep)

python analysis/analyze.py ledger/<file>.jsonl   # independent verify + score`,
    ),
    callout(
      'A good first end-to-end check: ', code('npm run smoke:witness'),
      ' to generate a witnessed session, then ', code('python analysis/analyze.py'),
      ' on the resulting ledger file to independently re-verify and score it. See ',
      link(P.verify, 'verify a result yourself'), '.',
    ),
  ];
}

export function renderArchitecture(): Child[] {
  return [
    lead(
      'A short tour of how the code is organized — and the one idea that makes the choice of backend language scientifically irrelevant.',
    ),

    h2('trust-path', 'The trust-path principle'),
    p('A reviewer’s trust divides cleanly into two paths:'),
    defs([
      ['Integrity path (cryptographic)', ['Capture raw bits, commit, sign, hash-chain, log. Verified by ', b('re-computation'), ' from published artifacts — language-independent. SHA-256 / Ed25519 / Merkle behave identically everywhere; an auditor re-checks them and never trusts our implementation.']],
      ['Statistical path (inference)', ['Every confirmatory number is produced by the open, deterministic ', code('analysis/'), ' Python pipeline run over the published raw data — never by the live server. The on-screen sigma is ', b('display-only'), '.']],
    ]),
    callout(
      'Because the backend sits only in the integrity path (which is cryptographically self-verifying) and never in the statistical path, ',
      b('the choice of backend language carries no scientific risk.'),
      ' The one place a systems language genuinely helps — direct, auditable hardware-entropy access — is isolated into a tiny Rust sidecar.',
    ),

    h2('stack', 'The stack'),
    ul([
      [b('TypeScript / Node '), '— the server (HTTP + WebSocket, session state machine, generation loop, persistence) and the client (this website).'],
      [b('Rust '), '— a minimal ', em('entropy-provider sidecar'), ' (a few hundred lines) emitting raw, unconditioned bytes from a selected ', link(P.entropy, 'source'), ' with health/metadata. Small enough to audit in one sitting.'],
      [b('Python '), '— the separate, versioned ', link(P.verify, 'analysis pipeline'), ', the lingua franca reviewers expect.'],
      [b('Primitives '), '— SHA-256, Ed25519, a domain-separated Merkle tree, and RFC 8785 JCS canonical JSON so hashes reproduce byte-for-byte across all three languages (', link(P.crypto, 'details'), ').'],
    ]),

    h2('layout', 'Repository layout'),
    pre(
`psimeter/
  docs/                 spec, protocol, pre-registration
  schema/               shared JSON Schemas — cross-language source of truth
  packages/
    core/               TS, pure & I/O-free: commitments, Merkle, ledger chaining,
                        canonicalization, scoring-for-display. Exhaustively tested.
    server/             TS: HTTP + WebSocket, orchestration, generation, storage
    witness/            TS: independent live-witness node (D16)
    entropy-provider/   Rust: raw-bytes sidecar (os | rdseed | usb-trng) + health
    client/             TS: the website (this wiki lives here)
  analysis/             Python: deterministic stats over published raw data + ledger
  ledger/               dev data: append-only entries + content-addressed raw blobs`,
    ),
    p(
      'The ', code('core'),
      ' package is deliberately pure and I/O-free so the correctness-critical logic is trivial to audit and test in isolation. The full design rationale lives in the ',
      link(P.decisions, 'decision log'), '.',
    ),
  ];
}

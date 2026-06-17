# @psymeter/server

HTTP + one-way WebSocket server, session orchestration, and the generation loop.

**Phase 1 status:** the HTTP + one-way WebSocket transport, session
orchestration, and live generation loop are working. The server picks the RDSEED
sidecar automatically when it is built (else the NON-confirmatory OS source);
override with `PSYMETER_ENTROPY=os|rdseed`. Still stubbed: operator Ed25519
signing, a live public beacon, and raw-blob persistence + external anchoring.

```bash
npm run build:core    # the server imports the built @psymeter/core
npm start             # http://localhost:8787 — run a session in the browser

# headless transport check (skips human-paced delays):
PSYMETER_FAST=1 PSYMETER_ENTROPY=os npm run smoke
```

- `POST /api/sessions {experimentId, version, intention}` → pre-commit (Phase A); returns the anchor.
- `WS /api/stream?session=ID` → one-way checkpoint stream (Phase B) then the seal (Phase C).

Layout:
- `src/entropy/` — `EntropySource` implementations (`os`, `sidecar`)
- `src/session.ts` — one-way generation + commitment + seal (spec §7)
- `src/experiments.ts` — loads versioned experiment definitions (D13)
- `src/index.ts` — entry point (demo today; HTTP/WS server next)

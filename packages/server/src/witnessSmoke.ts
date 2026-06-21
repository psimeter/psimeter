/**
 * Headless end-to-end smoke test for LIVE WITNESSES (spec §7.4, D16).
 *
 * Spawns the independent witness node, points the server at it, then:
 *   1. proves the witness REFUSES to co-sign a choice whose target round is
 *      already public (the anti-backdating guard),
 *   2. runs a witnessed micro-PK session and asserts the seal is witnessed,
 *   3. runs a witnessed precognition session (driving the two-way choice→sign→
 *      sensing→reveal loop) and asserts the seal is witnessed,
 *   4. prints the ledger + witness-feed paths so analyze.py can re-verify
 *      signatures, the choice-before-target timing, and the checkpoint prefixes.
 *
 *   PSIMETER_FAST=1 npx tsx src/witnessSmoke.ts
 */
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { trialCommit } from '@psimeter/core';
// NOTE: app.js reads PSIMETER_LEDGER / PSIMETER_FAST in module-level consts at
// import time, so it is imported DYNAMICALLY in main() AFTER we set the env.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pubRaw = Buffer.from((publicKey.export({ format: 'jwk' }) as { x: string }).x, 'base64url');
const operatorPubKey = `ed25519:${pubRaw.toString('hex')}`;
const sign = (m: string): string => `ed25519:${edSign(null, Buffer.from(m, 'utf8'), privateKey).toString('hex')}`;

const tmp = resolve(repoRoot, 'ledger/_witness_smoke');
const ledgerPath = resolve(tmp, 'dev.jsonl');
const feedPath = resolve(tmp, 'witness-feed.jsonl');
const keyPath = resolve(tmp, 'witness-key.pem');
const witnessPort = 8799;
const witnessUrl = `http://127.0.0.1:${witnessPort}`;

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  // eslint-disable-next-line no-console
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

async function waitFor(url: string, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

interface Created { sessionId: string; precommit: string; anchor: string; signPath: string; wsPath: string; params: Record<string, number>; }
async function createSession(base: string, experimentId: string, intention: string): Promise<Created> {
  const res = await fetch(`${base}/api/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ experimentId, version: 1, intention, operatorPubKey }),
  });
  if (!res.ok) throw new Error(`createSession ${experimentId}: HTTP ${res.status}`);
  return res.json() as Promise<Created>;
}
async function submitSign(base: string, signPath: string, precommit: string): Promise<void> {
  const res = await fetch(`${base}${signPath}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operatorSig: sign(precommit) }),
  });
  if (!res.ok) throw new Error(`sign rejected: HTTP ${res.status}`);
}

function runMicroPk(base: string, port: number): Promise<{ witnessed: boolean; checkpoints: number }> {
  return new Promise((resolveRun, reject) => {
    void (async () => {
      const s = await createSession(base, 'binary-micropk', 'HIGH');
      await submitSign(base, s.signPath, s.precommit);
      const ws = new WebSocket(`ws://127.0.0.1:${port}${s.wsPath}`);
      let checkpoints = 0;
      ws.on('message', (data) => {
        const m = JSON.parse(data.toString()) as Record<string, unknown>;
        if (m.type === 'checkpoint') checkpoints++;
        else if (m.type === 'seal') resolveRun({ witnessed: m.witnessed === true, checkpoints });
        else if (m.type === 'error') reject(new Error(`micro-PK stream error: ${String(m.message)}`));
      });
      ws.on('error', reject);
    })().catch(reject);
  });
}

function runPrecog(base: string, port: number): Promise<{ witnessed: boolean; hits: number; trials: number }> {
  return new Promise((resolveRun, reject) => {
    void (async () => {
      const s = await createSession(base, 'precognition-presentiment', '');
      await submitSign(base, s.signPath, s.precommit);
      const ws = new WebSocket(`ws://127.0.0.1:${port}${s.wsPath}`);
      const send = (o: object): void => ws.send(JSON.stringify(o));
      let sawSensing = false;
      ws.on('message', (data) => {
        const m = JSON.parse(data.toString()) as Record<string, unknown>;
        switch (m.type) {
          case 'trial':
            send({ type: 'choice', trialIndex: m.trialIndex, choice: 'calm' });
            break;
          case 'pending': {
            const tc = trialCommit({
              sessionId: s.sessionId, trialIndex: m.trialIndex as number, choice: 'calm',
              targetRound: m.targetRound as number, prevBeaconRound: m.prevBeaconRound as number, operatorPubKey,
            });
            send({ type: 'sign', trialIndex: m.trialIndex, operatorSig: sign(tc) });
            break;
          }
          case 'sensing': sawSensing = true; break;
          case 'seal':
            resolveRun({ witnessed: m.witnessed === true && sawSensing, hits: m.hits as number, trials: m.trials as number });
            break;
          case 'error': reject(new Error(`precog stream error: ${String(m.message)}`)); break;
        }
      });
      ws.on('error', reject);
    })().catch(reject);
  });
}

async function main(): Promise<void> {
  rmSync(tmp, { recursive: true, force: true });
  // Set the server env BEFORE app.js is (dynamically) imported — its ledger path
  // and FAST flag are read in module-level consts at import time.
  process.env.PSIMETER_BEACON = 'dev';
  process.env.PSIMETER_FAST = '1';
  process.env.PSIMETER_ENTROPY = 'os';
  process.env.PSIMETER_LEDGER = ledgerPath;
  process.env.PSIMETER_WITNESS = witnessUrl;
  process.env.PSIMETER_WITNESS_THRESHOLD = '1';

  const childEnv = {
    ...process.env,
    PSIMETER_BEACON: 'dev', PSIMETER_FAST: '1', PSIMETER_ENTROPY: 'os',
    PSIMETER_WITNESS_PORT: String(witnessPort), PSIMETER_WITNESS_FEED: feedPath,
    PSIMETER_WITNESS_KEY: keyPath, PSIMETER_WITNESS_TSA_INTERVAL_MS: '0',
  };
  // eslint-disable-next-line no-console
  console.log('[smoke] spawning witness node…');
  // Spawn node+tsx DIRECTLY (not via `npm run`, whose cmd/npm wrapper would not be
  // killed by witness.kill() on Windows, orphaning the port). `witness` is then the
  // real process and SIGTERM cleans it up.
  const witnessEntry = resolve(repoRoot, 'packages/witness/src/index.ts');
  const witness = spawn(process.execPath, ['--import', 'tsx', witnessEntry], { cwd: repoRoot, env: childEnv, stdio: 'inherit' });

  try {
    await waitFor(`${witnessUrl}/witness/info`);
    const winfo = (await (await fetch(`${witnessUrl}/witness/info`)).json()) as { witnessPubKey: string };
    // eslint-disable-next-line no-console
    console.log(`[smoke] witness up: ${winfo.witnessPubKey}\n`);

    // Import app.js now — its ledger path + FAST consts are read at import time,
    // and we set the env at the top of main().
    const { createApp } = await import('./app.js');
    const server = createApp();
    const port: number = await new Promise((r) => server.listen(0, () => r((server.address() as { port: number }).port)));
    const base = `http://127.0.0.1:${port}`;

    // 1. The witness must REFUSE to co-sign a choice whose target is already public.
    const refuse = await fetch(`${witnessUrl}/witness/attest`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectHash: 'sha256:00', sessionId: 'neg', trialIndex: 0, kind: 'choice', claimedTargetRound: 1 }),
    });
    check('witness refuses a choice whose target round is already public', refuse.status === 409, `HTTP ${refuse.status}`);

    // 2. Witnessed micro-PK session.
    const mp = await runMicroPk(base, port);
    check('micro-PK session sealed as witnessed', mp.witnessed, `${mp.checkpoints} checkpoints co-signed`);

    // 3. Witnessed precognition session (synchronous per-trial co-sign + sensing).
    const pc = await runPrecog(base, port);
    check('precognition session sealed as witnessed (per-trial co-sign + sensing seen)', pc.witnessed, `${pc.hits}/${pc.trials} hits`);

    server.close();
    // eslint-disable-next-line no-console
    console.log(`\n[smoke] ledger: ${ledgerPath}`);
    // eslint-disable-next-line no-console
    console.log(`[smoke] feed:   ${feedPath}`);
    // eslint-disable-next-line no-console
    console.log(`[smoke] re-verify independently:  python analysis/analyze.py ${ledgerPath}`);
  } finally {
    witness.kill();
  }

  // eslint-disable-next-line no-console
  console.log(`\n[smoke] ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

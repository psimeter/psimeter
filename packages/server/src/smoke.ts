/**
 * Headless end-to-end smoke test for the transport + signing handshake.
 *
 * Starts the server on an ephemeral port, then for a fresh operator key:
 *   1. creates a session (HTTP) and receives the pre-commitment,
 *   2. signs the pre-commitment and submits it (expect accepted),
 *   3. proves a BAD signature is rejected,
 *   4. drives the one-way WebSocket stream to completion.
 *
 *   PSIMETER_FAST=1 PSIMETER_ENTROPY=os npx tsx src/smoke.ts
 */
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { WebSocket } from 'ws';
import { createApp } from './app.js';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pubRaw = Buffer.from((publicKey.export({ format: 'jwk' }) as { x: string }).x, 'base64url');
const operatorPubKey = `ed25519:${pubRaw.toString('hex')}`;

function sign(message: string): string {
  return `ed25519:${edSign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex')}`;
}

async function createSession(base: string): Promise<{ sessionId: string; precommit: string; anchor: string; signPath: string; wsPath: string; entropy: { id: string } }> {
  const res = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ experimentId: 'binary-micropk', version: 1, intention: 'HIGH', operatorPubKey }),
  });
  return res.json() as Promise<{ sessionId: string; precommit: string; anchor: string; signPath: string; wsPath: string; entropy: { id: string } }>;
}

const server = createApp();
server.listen(0, async () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  // Negative test: a signature over the wrong message must be rejected.
  const bad = await createSession(base);
  const badRes = await fetch(`${base}${bad.signPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operatorSig: sign(bad.precommit + 'TAMPER') }),
  });
  console.log(`bad signature rejected: ${badRes.status === 400 ? 'YES' : 'NO (' + badRes.status + ')'}`);

  // Happy path: valid signature accepted, then stream to completion.
  const s = await createSession(base);
  const signRes = await fetch(`${base}${s.signPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operatorSig: sign(s.precommit) }),
  });
  console.log(`valid signature accepted: ${signRes.status === 200 ? 'YES' : 'NO (' + signRes.status + ')'}`);
  console.log(`session ${s.sessionId.slice(0, 8)}  anchor=${s.anchor}  entropy=${s.entropy.id}`);

  const ws = new WebSocket(`ws://127.0.0.1:${port}${s.wsPath}`);
  let checkpoints = 0;
  ws.on('message', (data) => {
    const m = JSON.parse(data.toString()) as Record<string, unknown>;
    if (m.type === 'checkpoint') checkpoints++;
    else if (m.type === 'seal') console.log(`  SEAL ones=${m.ones}/${m.nSamples}  raw=${m.rawBlobRef}`);
    else console.log(`  ${JSON.stringify(m)}`);
  });
  ws.on('close', () => {
    console.log(`received ${checkpoints} checkpoints, stream closed cleanly`);
    server.close();
  });
  ws.on('error', (e) => {
    console.error(e);
    process.exit(1);
  });
});

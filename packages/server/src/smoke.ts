/**
 * Headless end-to-end smoke test for the transport layer.
 *
 * Starts the server on an ephemeral port, creates a session over HTTP, then
 * drives the one-way WebSocket stream to completion and prints the result. Run
 * with PSYMETER_FAST=1 to skip the human-paced delays.
 *
 *   PSYMETER_FAST=1 PSYMETER_ENTROPY=os npx tsx src/smoke.ts
 */
import { WebSocket } from 'ws';
import { createApp } from './app.js';

const server = createApp();
server.listen(0, async () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const res = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ experimentId: 'binary-micropk', version: 1, intention: 'HIGH' }),
  });
  const info = (await res.json()) as { sessionId: string; anchor: string; wsPath: string; entropy: { id: string } };
  console.log(`created session ${info.sessionId.slice(0, 8)}  anchor=${info.anchor}  entropy=${info.entropy.id}`);

  const ws = new WebSocket(`ws://127.0.0.1:${port}${info.wsPath}`);
  let checkpoints = 0;

  ws.on('message', (data) => {
    const m = JSON.parse(data.toString()) as Record<string, unknown>;
    if (m.type === 'checkpoint') {
      checkpoints++;
      if (checkpoints <= 2 || checkpoints % 60 === 0) {
        console.log(`  checkpoint ${checkpoints}: trial=${m.trial} z=${(m.zDisplay as number).toFixed(3)}`);
      }
    } else if (m.type === 'seal') {
      console.log(`  SEAL ones=${m.ones}/${m.nSamples}  commit=${(m.outputCommitment as string).slice(0, 22)}…`);
    } else {
      console.log(`  ${JSON.stringify(m)}`);
    }
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

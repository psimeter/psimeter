import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { EntropySource, Intention } from '@psymeter/core';
import { LedgerStore } from './ledgerStore.js';
import { loadExperiment } from './experiments.js';
import { selectEntropySource } from './select.js';
import { selectBeacon, type BeaconProvider } from './beacon.js';
import { commitOpen, generateAndSeal, prepareSession, type SessionContext } from './session.js';
import { verifyEd25519 } from './sign.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const clientDir = resolve(repoRoot, 'packages/client');
// Relative PSYMETER_LEDGER values resolve against the repo root; absolute paths
// are honored as-is. Lets each experiment campaign keep its own ledger file.
const ledgerPath = resolve(repoRoot, process.env.PSYMETER_LEDGER ?? 'ledger/dev.jsonl');

/** Pacing is FAST (no inter-checkpoint delay) for tests; off in normal use. */
const FAST = process.env.PSYMETER_FAST === '1';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

const SIGN_ROUTE = /^\/api\/sessions\/([^/]+)\/sign$/;

/**
 * Build the PsyMeter HTTP + one-way WebSocket server (spec §8).
 *
 * Handshake (spec §7.2):
 *   1. `POST /api/sessions` declares experiment + intention + operator key and
 *      returns the pre-commitment + anchor (Phase A, part 1). Nothing is logged
 *      yet and no randomness exists.
 *   2. `POST /api/sessions/:id/sign` submits the operator's Ed25519 signature
 *      over the pre-commitment; the server verifies it and only then logs the
 *      immutable `session.open` entry (Phase A, part 2).
 *   3. `WS /api/stream?session=ID` streams checkpoints (Phase B) then the seal
 *      (Phase C). The server reads NOTHING from this socket — it is one-way.
 */
export function createApp(): http.Server {
  const store = new LedgerStore(ledgerPath);
  store.ensureGenesis();
  const entropy: EntropySource = selectEntropySource();
  const beaconProvider = selectBeacon();
  const sessions = new Map<string, SessionContext>();

  // eslint-disable-next-line no-console
  console.log(
    `[entropy] using "${entropy.id}" (${entropy.kind}), confirmatory=${entropy.confirmatory}` +
      (entropy.confirmatory ? '' : '  - NON-CONFIRMATORY: pipeline/pilot only, not scientific data'),
  );
  // eslint-disable-next-line no-console
  console.log(
    `[beacon] using "${beaconProvider.id}"` +
      (beaconProvider.id === 'dev' ? '  - NON-CONFIRMATORY placeholder (offline)' : ''),
  );

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/sessions') {
      void handleCreateSession(req, res, store, entropy, beaconProvider, sessions);
      return;
    }
    const signMatch = req.method === 'POST' ? req.url?.match(SIGN_ROUTE) : null;
    if (signMatch) {
      void handleSign(req, res, signMatch[1]!, store, sessions);
      return;
    }
    if (req.url?.startsWith('/api/')) {
      res.writeHead(404).end('not found');
      return;
    }
    void serveStatic(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== '/api/stream') {
      socket.destroy();
      return;
    }
    const id = url.searchParams.get('session') ?? '';
    wss.handleUpgrade(req, socket, head, (ws) => handleStream(ws, id, store, sessions));
  });

  return server;
}

async function handleCreateSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  store: LedgerStore,
  entropy: EntropySource,
  beaconProvider: BeaconProvider,
  sessions: Map<string, SessionContext>,
): Promise<void> {
  try {
    const body = JSON.parse(await readBody(req)) as {
      experimentId?: string;
      version?: number;
      intention?: Intention;
      operatorPubKey?: string;
    };
    if (!body.operatorPubKey) {
      sendJson(res, 400, { error: 'operatorPubKey required (operator identity, D6)' });
      return;
    }
    const experiment = loadExperiment(body.experimentId ?? 'binary-micropk', body.version ?? 1);
    const intention = body.intention ?? 'HIGH';
    if (!experiment.intentions.includes(intention)) {
      sendJson(res, 400, { error: `invalid intention "${intention}"` });
      return;
    }

    // Bind a fresh public beacon pulse so the session provably postdates it (D2).
    const beacon = await beaconProvider.fetchPulse();

    const ctx = prepareSession(store, { experiment, intention, operatorPubKey: body.operatorPubKey, beacon, source: entropy });
    sessions.set(ctx.sessionId, ctx);

    sendJson(res, 200, {
      sessionId: ctx.sessionId,
      precommit: ctx.precommit,
      anchor: ctx.anchor,
      experiment: { id: experiment.id, version: experiment.version, title: experiment.title },
      params: ctx.params,
      intention,
      entropy: { id: entropy.id, kind: entropy.kind, confirmatory: entropy.confirmatory },
      signPath: `/api/sessions/${ctx.sessionId}/sign`,
      wsPath: `/api/stream?session=${ctx.sessionId}`,
    });
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

async function handleSign(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
  store: LedgerStore,
  sessions: Map<string, SessionContext>,
): Promise<void> {
  try {
    const ctx = sessions.get(id);
    if (!ctx) {
      sendJson(res, 404, { error: 'unknown session' });
      return;
    }
    if (ctx.open) {
      sendJson(res, 409, { error: 'session already signed' });
      return;
    }
    const body = JSON.parse(await readBody(req)) as { operatorSig?: string };
    if (!body.operatorSig || !verifyEd25519(ctx.operatorPubKey, ctx.precommit, body.operatorSig)) {
      sendJson(res, 400, { error: 'invalid operator signature' });
      return;
    }
    const open = commitOpen(store, ctx, body.operatorSig);
    sendJson(res, 200, { ok: true, openEntryHash: open.entryHash });
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

function handleStream(
  ws: WebSocket,
  id: string,
  store: LedgerStore,
  sessions: Map<string, SessionContext>,
): void {
  const ctx = sessions.get(id);
  if (!ctx || !ctx.open || ctx.started) {
    ws.send(JSON.stringify({ type: 'error', message: 'session not found, unsigned, or already started' }));
    ws.close();
    return;
  }
  ctx.started = true;

  // One-way isolation: ignore anything the client sends during generation.
  ws.on('message', () => {});

  const p = ctx.params;
  const trialsPerSec = p.bitRatePerSec / p.trialBits;
  const tickMs = FAST ? 0 : Math.round((1000 * p.checkpointEveryTrials) / trialsPerSec);

  ws.send(JSON.stringify({ type: 'started', tickMs, sessionSeconds: p.sessionSeconds }));

  generateAndSeal(ctx, store, {
    tickMs,
    onCheckpoint: (c) => safeSend(ws, { type: 'checkpoint', ...c }),
  })
    .then((seal) => {
      const payload = seal.payload as { ones: number; nSamples: number; outputCommitment: string };
      safeSend(ws, {
        type: 'seal',
        sessionId: ctx.sessionId,
        anchor: ctx.anchor,
        ones: payload.ones,
        nSamples: payload.nSamples,
        outputCommitment: payload.outputCommitment,
        openEntryHash: ctx.open!.entryHash,
        sealEntryHash: seal.entryHash,
      });
    })
    .catch((err) => safeSend(ws, { type: 'error', message: String(err) }))
    .finally(() => {
      sessions.delete(id);
      ws.close();
    });
}

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const rel = decodeURIComponent((req.url ?? '/').split('?')[0]!);
  const fsPath = resolve(clientDir, '.' + (rel === '/' ? '/index.html' : rel));
  if (!fsPath.startsWith(clientDir)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const data = await readFile(fsPath);
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(fsPath)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, obj: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

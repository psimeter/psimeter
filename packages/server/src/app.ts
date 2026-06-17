import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { BeaconRef, EntropySource, Intention } from '@psymeter/core';
import { LedgerStore } from './ledgerStore.js';
import { loadExperiment } from './experiments.js';
import { selectEntropySource } from './select.js';
import { generateAndSeal, openSession, type SessionContext } from './session.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const clientDir = resolve(repoRoot, 'packages/client');
const ledgerPath = resolve(repoRoot, 'ledger/dev.jsonl');

/** Pacing is FAST (no inter-checkpoint delay) for tests; off in normal use. */
const FAST = process.env.PSYMETER_FAST === '1';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

/**
 * Build the PsyMeter HTTP + one-way WebSocket server (spec §8).
 *
 * - `POST /api/sessions` declares the experiment + intention and performs the
 *   pre-commitment (Phase A). This is the ONLY client→server influence, and it
 *   happens before any randomness exists.
 * - `WS /api/stream?session=ID` streams checkpoints (Phase B) then the seal
 *   (Phase C). The server reads NOTHING from this socket — it is one-way.
 * - Everything else serves the static client.
 */
export function createApp(): http.Server {
  const store = new LedgerStore(ledgerPath);
  store.ensureGenesis();
  const entropy: EntropySource = selectEntropySource();
  const sessions = new Map<string, SessionContext>();

  // eslint-disable-next-line no-console
  console.log(
    `[entropy] using "${entropy.id}" (${entropy.kind}), confirmatory=${entropy.confirmatory}` +
      (entropy.confirmatory ? '' : '  — NON-CONFIRMATORY: pipeline/pilot only, not scientific data'),
  );

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/sessions') {
      void handleCreateSession(req, res, store, entropy, sessions);
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
  sessions: Map<string, SessionContext>,
): Promise<void> {
  try {
    const body = JSON.parse(await readBody(req)) as {
      experimentId?: string;
      version?: number;
      intention?: Intention;
      operatorPubKey?: string;
    };
    const experiment = loadExperiment(body.experimentId ?? 'binary-micropk', body.version ?? 1);
    const intention = body.intention ?? 'HIGH';
    if (!experiment.intentions.includes(intention)) {
      sendJson(res, 400, { error: `invalid intention "${intention}"` });
      return;
    }

    // TODO(beacon): replace this dev placeholder with a live drand/NIST pulse.
    const beacon: BeaconRef = { source: 'dev', round: 0, value: '00' };
    // TODO(D6): the operator's pseudonymous key arrives from the client and signs the precommit.
    const operatorPubKey = body.operatorPubKey ?? 'ed25519:UNSIGNED';

    const ctx = openSession(store, { experiment, intention, operatorPubKey, beacon, source: entropy });
    sessions.set(ctx.sessionId, ctx);

    sendJson(res, 200, {
      sessionId: ctx.sessionId,
      anchor: ctx.anchor,
      precommit: ctx.precommit,
      experiment: { id: experiment.id, version: experiment.version, title: experiment.title },
      params: ctx.params,
      intention,
      entropy: { id: entropy.id, kind: entropy.kind, confirmatory: entropy.confirmatory },
      wsPath: `/api/stream?session=${ctx.sessionId}`,
    });
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
  if (!ctx || ctx.started) {
    ws.send(JSON.stringify({ type: 'error', message: 'invalid or already-started session' }));
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
        openEntryHash: ctx.open.entryHash,
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

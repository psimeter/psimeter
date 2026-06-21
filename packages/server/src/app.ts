import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { canonicalize, choiceVocabulary, isValidChoice, type Choice, type EntropySource } from '@psimeter/core';
import { LedgerStore } from './ledgerStore.js';
import { loadExperiment, listExperiments } from './experiments.js';
import {
  LedgerReader,
  globalStats,
  experimentStat,
  leaderboard,
  psiForOperator,
  type OpenPayload,
} from './ledgerReader.js';
import { saveContact } from './contactStore.js';
import { selectEntropySource } from './select.js';
import { selectBeacon, type BeaconProvider } from './beacon.js';
import { selectWitnessClient, type WitnessClient } from './witnessClient.js';
import { commitOpen, prepareSession, type SessionContext } from './session.js';
import { streamMicroPk } from './kinds/microPk.js';
import { streamPrecog } from './kinds/precog.js';
import { safeSend } from './wsSend.js';
import { verifyEd25519 } from './sign.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
// The built public site (Vite output). Populate it with `npm run build:client`;
// for hot-reload development use `npm run dev:client` (Vite serves on :5173 and
// proxies /api back to this server).
const clientDir = resolve(repoRoot, 'packages/client/dist');
// Relative PSIMETER_LEDGER values resolve against the repo root; absolute paths
// are honored as-is. Lets each experiment campaign keep its own ledger file.
const ledgerPath = resolve(repoRoot, process.env.PSIMETER_LEDGER ?? 'ledger/dev.jsonl');
const blobDir = resolve(dirname(ledgerPath), 'blobs');
// PRIVATE, off-ledger store for opt-in psi-candidate contacts (D15). Holds PII,
// so it lives beside the ledger (git-ignored) and is NEVER served over /api.
const contactsPath = resolve(dirname(ledgerPath), 'contacts.jsonl');
// Presentiment stimulus corpus (content-hash-pinned in the experiment def, D14).
const stimuliDir = resolve(repoRoot, 'stimuli');

/** Pacing is FAST (no inter-checkpoint delay) for tests; off in normal use. */
const FAST = process.env.PSIMETER_FAST === '1';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Shown when the server runs but the client has not been built yet. */
const NOT_BUILT_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>PsiMeter — build the client</title></head>
<body style="font-family:system-ui;background:#07090d;color:#e8edf4;max-width:640px;margin:48px auto;padding:0 20px;line-height:1.6">
<h1 style="font-weight:650">PsiMeter server is running</h1>
<p>The public site hasn't been built yet. From the repo root:</p>
<pre style="background:#10151d;border:1px solid #1d2632;padding:14px;border-radius:8px;overflow:auto">npm run build:client   <span style="color:#5e6b7c"># production build, served from here</span>
<span style="color:#5e6b7c"># or, for live development with hot reload:</span>
npm run dev:client     <span style="color:#5e6b7c"># Vite on :5173, proxies /api to this server</span></pre>
<p>The API is already up at <code>/api</code>.</p>
</body></html>`;

const SIGN_ROUTE = /^\/api\/sessions\/([^/]+)\/sign$/;
const SESSION_DETAIL_ROUTE = /^\/api\/sessions\/([^/]+)$/;

/**
 * Build the PsiMeter HTTP + one-way WebSocket server (spec §8).
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
  const witness = selectWitnessClient();
  const sessions = new Map<string, SessionContext>();
  const reader = new LedgerReader(ledgerPath);

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
  // eslint-disable-next-line no-console
  console.log(
    witness.enabled
      ? `[witness] live witnessing ON: ${witness.urls.length} witness(es), threshold ${witness.threshold} (spec D16)`
      : '[witness] live witnessing OFF (set PSIMETER_WITNESS=url[,url] to enable; sessions sealed as witnessed:false)',
  );

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (req.method === 'POST' && path === '/api/sessions') {
      void handleCreateSession(req, res, store, entropy, beaconProvider, sessions);
      return;
    }
    const signMatch = req.method === 'POST' ? path.match(SIGN_ROUTE) : null;
    if (signMatch) {
      void handleSign(req, res, signMatch[1]!, store, sessions);
      return;
    }
    // Opt-in psi-candidate contact (D15): operator-signed, eligibility recomputed
    // from the ledger, stored privately off-ledger.
    if (req.method === 'POST' && path === '/api/contact') {
      void handleContact(req, res, reader);
      return;
    }
    if (req.method === 'GET') {
      if (path === '/api/experiments') {
        handleExperiments(res, reader);
        return;
      }
      if (path === '/api/stats') {
        sendJson(res, 200, globalStats(reader.summaries()));
        return;
      }
      // Per-operator psi leaderboard (D15 / H1): consistency, not lucky sessions.
      if (path === '/api/leaderboard') {
        sendJson(res, 200, leaderboard(reader.summaries()));
        return;
      }
      // Configured live witnesses (D16): identities + threshold, so the in-browser
      // /verify knows which co-signers to expect. The trusted set is ultimately the
      // auditor's (a published list), not whatever the server reports here.
      if (path === '/api/witness') {
        void witness.info().then(
          (witnesses) => sendJson(res, 200, { enabled: witness.enabled, threshold: witness.threshold, witnesses }),
          () => sendJson(res, 200, { enabled: witness.enabled, threshold: witness.threshold, witnesses: [] }),
        );
        return;
      }
      // Lightweight per-operator psi score (for the always-visible header chip).
      if (path === '/api/psi') {
        const operator = url.searchParams.get('operator');
        if (!operator) {
          sendJson(res, 400, { error: 'operator required' });
          return;
        }
        sendJson(res, 200, { psi: psiForOperator(reader.summaries(), operator) });
        return;
      }
      const detailMatch = path.match(SESSION_DETAIL_ROUTE);
      if (detailMatch) {
        handleSessionDetail(res, reader, detailMatch[1]!);
        return;
      }
      if (path === '/api/sessions') {
        handleSessionList(res, reader, url.searchParams);
        return;
      }
    }
    if (path.startsWith('/api/')) {
      res.writeHead(404).end('not found');
      return;
    }
    // Raw blobs are public artifacts (D2) — serve them so the in-browser /verify
    // can re-derive precognition trials and re-check Merkle roots without trusting us.
    if (req.method === 'GET' && path.startsWith('/blobs/')) {
      void serveFromDir(blobDir, '/blobs/', res, path);
      return;
    }
    // Presentiment stimulus images (content-hash-pinned in the experiment def,
    // D14) — served for the live reveal and for in-browser pixel verification.
    if (req.method === 'GET' && path.startsWith('/stimuli/')) {
      void serveFromDir(stimuliDir, '/stimuli/', res, path);
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
    wss.handleUpgrade(req, socket, head, (ws) => handleStream(ws, id, store, sessions, beaconProvider, witness));
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
      intention?: Choice;
      operatorPubKey?: string;
    };
    if (!body.operatorPubKey) {
      sendJson(res, 400, { error: 'operatorPubKey required (operator identity, D6)' });
      return;
    }
    const experiment = loadExperiment(body.experimentId ?? 'binary-micropk', body.version ?? 1);
    // Micro-PK commits a single session-level choice (HIGH/LOW/BASELINE) here;
    // kinds whose choices are per-trial (precognition) commit none — they bind
    // each choice to a future beacon round during the run instead (spec §7.5).
    let intention = '';
    if (experiment.kind === 'micro-pk-binary') {
      intention = body.intention ?? choiceVocabulary(experiment)[0] ?? '';
      if (!isValidChoice(experiment, intention)) {
        sendJson(res, 400, { error: `invalid choice "${intention}" for ${experiment.id}` });
        return;
      }
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

function handleExperiments(res: http.ServerResponse, reader: LedgerReader): void {
  const rows = reader.summaries();
  const experiments = listExperiments().map((d) => ({
    id: d.id,
    version: d.version,
    title: d.title,
    kind: d.kind,
    params: d.params,
    choices: choiceVocabulary(d),
    stimuli: d.stimuli ?? null,
    contentWarning: (d as { contentWarning?: string }).contentWarning ?? null,
    stats: experimentStat(rows, d.id),
  }));
  sendJson(res, 200, { experiments });
}

function handleSessionList(res: http.ServerResponse, reader: LedgerReader, params: URLSearchParams): void {
  const operator = params.get('operator');
  const all = reader.summaries();
  let rows = operator ? all.filter((r) => r.operatorPubKey === operator) : all;
  // The operator's psi score is computed over ALL their sessions, before the
  // display slice below (D15) — so the history page can show the live ladder.
  const psi = operator ? psiForOperator(all, operator) : null;
  const limit = Math.min(Math.max(Number(params.get('limit')) || 200, 1), 1000);
  rows = rows.slice().reverse().slice(0, limit); // most recent first
  sendJson(res, 200, { sessions: rows, psi });
}

/**
 * Opt-in contact for a psi candidate (spec D15). The operator signs a canonical
 * challenge (proving key custody), the server re-derives their psi score from the
 * public ledger and requires candidate status, then stores the contact privately
 * off-ledger. No PII is ever logged to the public chain or returned by any GET.
 */
async function handleContact(req: http.IncomingMessage, res: http.ServerResponse, reader: LedgerReader): Promise<void> {
  try {
    const body = JSON.parse(await readBody(req)) as {
      operatorPubKey?: string;
      contact?: string;
      message?: string;
      operatorSig?: string;
    };
    const operatorPubKey = body.operatorPubKey ?? '';
    const contact = (body.contact ?? '').slice(0, 2000);
    const message = (body.message ?? '').slice(0, 4000);
    if (!operatorPubKey || !body.operatorSig) {
      sendJson(res, 400, { error: 'operatorPubKey and operatorSig required' });
      return;
    }
    // The signed challenge binds the exact fields, so the server can't be tricked
    // into accepting a sig over different content.
    const challenge = canonicalize({ type: 'psi.contact', operatorPubKey, contact, message });
    if (!verifyEd25519(operatorPubKey, challenge, body.operatorSig)) {
      sendJson(res, 400, { error: 'invalid operator signature' });
      return;
    }
    const psi = psiForOperator(reader.summaries(), operatorPubKey);
    if (!psi.isCandidate) {
      sendJson(res, 403, { error: 'not eligible: psi score has not reached the candidate threshold' });
      return;
    }
    saveContact(contactsPath, {
      ts: new Date().toISOString(),
      operatorPubKey,
      contact,
      message,
      operatorSig: body.operatorSig,
      psiPoints: psi.points,
      wealth: psi.wealth,
    });
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

function handleSessionDetail(res: http.ServerResponse, reader: LedgerReader, id: string): void {
  const detail = reader.detail(id);
  if (!detail) {
    sendJson(res, 404, { error: 'unknown session' });
    return;
  }
  const open = detail.open.payload as OpenPayload;
  let experiment: unknown = null;
  try {
    experiment = loadExperiment(open.experimentId, open.experimentVersion);
  } catch {
    experiment = null; // definition file unavailable; the chain is still verifiable
  }
  sendJson(res, 200, { sessionId: id, open: detail.open, seal: detail.seal, experiment });
}

function handleStream(
  ws: WebSocket,
  id: string,
  store: LedgerStore,
  sessions: Map<string, SessionContext>,
  beaconProvider: BeaconProvider,
  witness: WitnessClient,
): void {
  const ctx = sessions.get(id);
  if (!ctx || !ctx.open || ctx.started) {
    safeSend(ws, { type: 'error', message: 'session not found, unsigned, or already started' });
    ws.close();
    return;
  }
  ctx.started = true;
  ws.on('close', () => sessions.delete(id));

  // Dispatch to the kind's generation/reveal protocol (spec §10). Micro-PK is a
  // one-way stream; precognition is a two-way per-trial commit→reveal loop.
  switch (ctx.experiment.kind) {
    case 'micro-pk-binary':
      streamMicroPk(ws, ctx, store, witness, { blobDir, fast: FAST });
      break;
    case 'precognition-presentiment':
      streamPrecog(ws, ctx, store, beaconProvider, witness, { blobDir });
      break;
    default:
      safeSend(ws, { type: 'error', message: `no runner for kind "${ctx.experiment.kind}"` });
      ws.close();
  }
}

/**
 * Serve the built single-page site. Real files (hashed JS/CSS assets) are served
 * directly; navigation routes with no file extension (e.g. /about, /run) fall
 * back to index.html so deep links and reloads work client-side. If the build is
 * missing entirely, show a friendly "run the build" page instead of a bare 404.
 */
async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const rel = decodeURIComponent((req.url ?? '/').split('?')[0]!);
  const isNavigation = extname(rel) === '';
  const fsPath = resolve(clientDir, '.' + (rel === '/' ? '/index.html' : rel));
  if (!fsPath.startsWith(clientDir)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (await tryServeFile(fsPath, res)) return;
  if (isNavigation) {
    if (await tryServeFile(resolve(clientDir, 'index.html'), res)) return;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(NOT_BUILT_HTML);
    return;
  }
  res.writeHead(404).end('not found');
}

/** Serve a public file from a fixed base directory, with path-traversal guard. */
async function serveFromDir(baseDir: string, prefix: string, res: http.ServerResponse, urlPath: string): Promise<void> {
  const name = decodeURIComponent(urlPath.slice(prefix.length));
  const fsPath = resolve(baseDir, name);
  if (!fsPath.startsWith(baseDir)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (!(await tryServeFile(fsPath, res))) res.writeHead(404).end('not found');
}

/** Read and send a file; returns false (without responding) if it is absent. */
async function tryServeFile(fsPath: string, res: http.ServerResponse): Promise<boolean> {
  try {
    const data = await readFile(fsPath);
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(fsPath)] ?? 'application/octet-stream' });
    res.end(data);
    return true;
  } catch {
    return false;
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

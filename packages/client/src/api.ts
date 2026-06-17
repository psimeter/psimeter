// Typed client for the PsyMeter server (packages/server/src/app.ts).
//
// Handshake (spec §7.2): POST /api/sessions returns the pre-commitment + anchor;
// the operator signs the pre-commitment and POSTs it to signPath; then a ONE-WAY
// WebSocket streams checkpoints and the final seal. The socket is receive-only —
// nothing this client sends can reach the generator (pillar 5).

export type Intention = 'HIGH' | 'LOW' | 'BASELINE';

export interface EntropyGrade {
  id: string;
  kind: string;
  confirmatory: boolean;
}

export interface SessionParams {
  trialBits: number;
  bitRatePerSec: number;
  sessionSeconds: number;
  trialsPerSession: number;
  bitsPerSession: number;
  checkpointEveryTrials: number;
  intentionAssignment: string;
  conditioning: string;
}

export interface CreatedSession {
  sessionId: string;
  precommit: string;
  anchor: string;
  experiment: { id: string; version: number; title: string };
  params: SessionParams;
  intention: Intention;
  entropy: EntropyGrade;
  signPath: string;
  wsPath: string;
}

export interface Started { type: 'started'; tickMs: number; sessionSeconds: number; }
export interface Checkpoint { type: 'checkpoint'; trial: number; ones: number; total: number; zDisplay: number; root: string; }
export interface Seal {
  type: 'seal';
  sessionId: string;
  anchor: string;
  ones: number;
  nSamples: number;
  outputCommitment: string;
  rawBlobRef: string;
  openEntryHash: string;
  sealEntryHash: string;
}
export interface StreamError { type: 'error'; message: string; }
export type StreamMessage = Started | Checkpoint | Seal | StreamError;

export interface CreateSessionRequest {
  experimentId: string;
  version: number;
  intention: Intention;
  operatorPubKey: string;
}

export async function createSession(req: CreateSessionRequest): Promise<CreatedSession> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'could not create session'));
  return (await res.json()) as CreatedSession;
}

export async function submitSignature(signPath: string, operatorSig: string): Promise<void> {
  const res = await fetch(signPath, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operatorSig }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'signature rejected by server'));
}

export interface StreamHandlers {
  onStarted?: (m: Started) => void;
  onCheckpoint?: (m: Checkpoint) => void;
  onSeal?: (m: Seal) => void;
  onError?: (message: string) => void;
}

/** Open the one-way feed. Returns a disposer that closes the socket. */
export function openStream(wsPath: string, handlers: StreamHandlers): () => void {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${scheme}://${location.host}${wsPath}`);
  ws.onmessage = (ev) => {
    let m: StreamMessage;
    try { m = JSON.parse(ev.data as string) as StreamMessage; } catch { return; }
    switch (m.type) {
      case 'started': handlers.onStarted?.(m); break;
      case 'checkpoint': handlers.onCheckpoint?.(m); break;
      case 'seal': handlers.onSeal?.(m); break;
      case 'error': handlers.onError?.(m.message); break;
    }
  };
  ws.onerror = () => handlers.onError?.('stream connection error');
  return () => { try { ws.close(); } catch { /* already closing */ } };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

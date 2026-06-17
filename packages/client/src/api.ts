// Typed client for the PsyMeter server (packages/server/src/app.ts).
//
// Handshake (spec §7.2): POST /api/sessions returns the pre-commitment + anchor;
// the operator signs the pre-commitment and POSTs it to signPath; then a ONE-WAY
// WebSocket streams checkpoints and the final seal. The socket is receive-only —
// nothing this client sends can reach the generator (pillar 5).

import type { LedgerEntry, ExperimentDefinition, BeaconRef } from '@psymeter/core';

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

// ---------- read APIs (browse / stats / history / verify) ----------

export interface OpenPayload {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  intention: Intention;
  operatorPubKey: string;
  operatorSig: string;
  beacon: BeaconRef;
  entropySource: { id: string; kind: string; confirmatory: boolean; metadata: unknown };
  serverNonce: string;
  precommit: string;
  anchor: string;
}

export interface SealPayload {
  sessionId: string;
  openEntryHash: string;
  outputCommitment: string;
  rawSha256: string;
  rawBlobRef: string;
  leafBytes: number;
  nSamples: number;
  ones: number;
}

export interface SessionSummary {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  intention: Intention;
  operatorPubKey: string;
  anchor: string;
  beaconRound: number;
  entropy: { id: string; confirmatory: boolean };
  ts: string;
  sealed: boolean;
  ones: number | null;
  nSamples: number | null;
  zDisplay: number | null;
}

export interface IntentionStat { n: number; meanZ: number | null; }

export interface ExperimentInfo {
  id: string;
  version: number;
  title: string;
  kind: string;
  params: Record<string, unknown>;
  intentions: Intention[];
  stats: { sessions: number; sealed: number; byIntention: Record<Intention, number> };
}

export interface GlobalStats {
  sessions: number;
  sealed: number;
  totalBits: number;
  byIntention: Record<Intention, IntentionStat>;
  anomalies: { z2: number; z3: number; expectedZ2: number; expectedZ3: number };
  highMinusLow: number | null;
  extremes: SessionSummary[];
}

export interface SessionDetail {
  sessionId: string;
  open: LedgerEntry;
  seal: LedgerEntry | null;
  experiment: ExperimentDefinition | null;
}

export async function fetchExperiments(): Promise<ExperimentInfo[]> {
  const res = await fetch('/api/experiments');
  if (!res.ok) throw new Error('could not load experiments');
  return ((await res.json()) as { experiments: ExperimentInfo[] }).experiments;
}

export async function fetchStats(): Promise<GlobalStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('could not load stats');
  return (await res.json()) as GlobalStats;
}

export async function fetchSessions(operator?: string): Promise<SessionSummary[]> {
  const query = operator ? `?operator=${encodeURIComponent(operator)}` : '';
  const res = await fetch(`/api/sessions${query}`);
  if (!res.ok) throw new Error('could not load sessions');
  return ((await res.json()) as { sessions: SessionSummary[] }).sessions;
}

export async function fetchSessionDetail(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'could not load session'));
  return (await res.json()) as SessionDetail;
}

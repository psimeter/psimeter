// Typed client for the PsiMeter server (packages/server/src/app.ts).
//
// Handshake (spec §7.2): POST /api/sessions returns the pre-commitment + anchor;
// the operator signs the pre-commitment and POSTs it to signPath; then a ONE-WAY
// WebSocket streams checkpoints and the final seal. The socket is receive-only —
// nothing this client sends can reach the generator (pillar 5).

import type { LedgerEntry, ExperimentDefinition, BeaconRef, PsiScore, WitnessAttestation } from '@psimeter/core';

export type { PsiScore, WitnessAttestation };

/** Micro-PK intention (spec D3). A specific choice vocabulary; see `Choice`. */
export type Intention = 'HIGH' | 'LOW' | 'BASELINE';
/** A committed operator decision, generically (micro-PK intention, precog option id). */
export type Choice = string;

export interface EntropyGrade {
  id: string;
  kind: string;
  confirmatory: boolean;
}

/** Frozen, content-hashed parameter set — shape varies by kind; cast per runner. */
export type ExperimentParams = Record<string, number | string>;

/** The micro-PK integer parameter set (cast from ExperimentParams in its runner). */
export interface MicroPkParams {
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
  params: ExperimentParams;
  intention: Choice;
  entropy: EntropyGrade;
  signPath: string;
  wsPath: string;
}

export interface Started { type: 'started'; tickMs: number; sessionSeconds: number; witnessed?: boolean; }
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
  /** Co-signed live by an independent witness (spec D16). */
  witnessed?: boolean;
}
export interface StreamError { type: 'error'; message: string; }
export type StreamMessage = Started | Checkpoint | Seal | StreamError;

export interface CreateSessionRequest {
  experimentId: string;
  version: number;
  /** Committed choice. JSON key stays `intention` for canonical-hash parity. */
  intention: Choice;
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

// ---------- precognition (presentiment) two-way stream (spec §7.5) ----------

export interface PrecogStarted { type: 'started'; trialsPerSession: number; optionsPerTrial: number; sessionSeconds: number; beaconSource: string; witnessed?: boolean; }
export interface PrecogTrial { type: 'trial'; trialIndex: number; }
export interface PrecogPending { type: 'pending'; trialIndex: number; targetRound: number; prevBeaconRound: number; }
/** Sent after the signed choice, while an independent witness co-signs it (D16). */
export interface PrecogSensing { type: 'sensing'; trialIndex: number; }
export interface PrecogReveal {
  type: 'reveal';
  trialIndex: number;
  choice: Choice;
  /** 0 = calm, 1 = aversive — the valence the beacon destined. */
  valence: number;
  targetChoice: Choice;
  /** The actual stimulus image shown (path under /stimuli). */
  imagePath: string;
  hit: number;
  beaconRound: number;
  hits: number;
  completed: number;
  trialsPerSession: number;
}
export interface PrecogSeal {
  type: 'seal';
  sessionId: string;
  anchor: string;
  hits: number;
  trials: number;
  optionsPerTrial: number;
  outputCommitment: string;
  rawBlobRef: string;
  openEntryHash: string;
  sealEntryHash: string;
  /** Co-signed live by an independent witness (spec D16). */
  witnessed?: boolean;
}
export type PrecogMessage = PrecogStarted | PrecogTrial | PrecogPending | PrecogSensing | PrecogReveal | PrecogSeal | StreamError;

export interface PrecogHandlers {
  onStarted?: (m: PrecogStarted) => void;
  onTrial?: (m: PrecogTrial) => void;
  onPending?: (m: PrecogPending) => void;
  onSensing?: (m: PrecogSensing) => void;
  onReveal?: (m: PrecogReveal) => void;
  onSeal?: (m: PrecogSeal) => void;
  onError?: (message: string) => void;
}

/** A live presentiment session: receive prompts, send the operator's signed choices. */
export interface PrecogSocket {
  sendChoice(trialIndex: number, choice: Choice): void;
  sendSign(trialIndex: number, operatorSig: string): void;
  close(): void;
}

export function openPrecogStream(wsPath: string, handlers: PrecogHandlers): PrecogSocket {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${scheme}://${location.host}${wsPath}`);
  const send = (obj: object): void => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };
  ws.onmessage = (ev) => {
    let m: PrecogMessage;
    try { m = JSON.parse(ev.data as string) as PrecogMessage; } catch { return; }
    switch (m.type) {
      case 'started': handlers.onStarted?.(m); break;
      case 'trial': handlers.onTrial?.(m); break;
      case 'pending': handlers.onPending?.(m); break;
      case 'sensing': handlers.onSensing?.(m); break;
      case 'reveal': handlers.onReveal?.(m); break;
      case 'seal': handlers.onSeal?.(m); break;
      case 'error': handlers.onError?.(m.message); break;
    }
  };
  ws.onerror = () => handlers.onError?.('stream connection error');
  return {
    sendChoice: (trialIndex, choice) => send({ type: 'choice', trialIndex, choice }),
    sendSign: (trialIndex, operatorSig) => send({ type: 'sign', trialIndex, operatorSig }),
    close: () => { try { ws.close(); } catch { /* already closing */ } },
  };
}

// ---------- read APIs (browse / stats / history / verify) ----------

export interface OpenPayload {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  /** Committed choice (micro-PK intention; '' when per-trial, e.g. precog). */
  intention: Choice;
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
  // micro-PK
  leafBytes?: number;
  nSamples?: number;
  ones?: number;
  // precognition
  trials?: number;
  hits?: number;
  optionsPerTrial?: number;
  // live witnesses (spec D16) — present only when witnessed:true
  witnessed?: boolean;
  witness?: { threshold: number; keys: string[]; open: WitnessAttestation[]; seal: WitnessAttestation[] };
  checkpoints?: { trial: number; root: string; witness: WitnessAttestation[] }[];
}

export interface SessionSummary {
  sessionId: string;
  experimentId: string;
  experimentVersion: number;
  /** Committed choice for display/grouping (was `intention`). */
  choice: Choice;
  operatorPubKey: string;
  anchor: string;
  beaconRound: number;
  entropy: { id: string; confirmatory: boolean };
  ts: string;
  sealed: boolean;
  /** Co-signed live by an independent witness (spec D16). */
  witnessed: boolean;
  /** Micro-PK volume (bits); null for kinds without a bit stream. */
  nSamples: number | null;
  /** Precognition volume; null for kinds without forced-choice trials. */
  trials: number | null;
  hits: number | null;
  zDisplay: number | null;
}

export interface ChoiceStat { n: number; meanZ: number | null; }

export interface ExperimentInfo {
  id: string;
  version: number;
  title: string;
  kind: ExperimentDefinition['kind'];
  params: Record<string, unknown>;
  choices: Choice[];
  stimuli: Record<string, unknown> | null;
  contentWarning: string | null;
  stats: { sessions: number; sealed: number; byChoice: Record<string, number> };
}

export interface GlobalStats {
  sessions: number;
  sealed: number;
  totalBits: number;
  byChoice: Record<string, ChoiceStat>;
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

/** History payload: the operator's sessions plus their psi score (D15), which the
 *  server computes over ALL of them (the list itself may be display-limited). */
export interface HistoryResult {
  sessions: SessionSummary[];
  psi: PsiScore | null;
}

export async function fetchSessions(operator?: string, limit?: number): Promise<HistoryResult> {
  const params = new URLSearchParams();
  if (operator) params.set('operator', operator);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await fetch(`/api/sessions${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('could not load sessions');
  return (await res.json()) as HistoryResult;
}

/** Just this operator's psi score — small payload for the always-visible header chip. */
export async function fetchPsi(operator: string): Promise<PsiScore> {
  const res = await fetch(`/api/psi?operator=${encodeURIComponent(operator)}`);
  if (!res.ok) throw new Error('could not load psi');
  return ((await res.json()) as { psi: PsiScore }).psi;
}

// ---------- psi leaderboard + candidate contact (spec D15 / H1) ----------

export interface OperatorRanking {
  operatorPubKey: string;
  totalSessions: number;
  lastTs: string;
  psi: PsiScore;
}

export interface Leaderboard {
  operators: OperatorRanking[];
  meta: {
    totalOperators: number;
    eligibleOperators: number;
    candidates: number;
    candidateWealth: number;
    candidateMinSessions: number;
    expectedFalseCandidates: number;
  };
}

export async function fetchLeaderboard(): Promise<Leaderboard> {
  const res = await fetch('/api/leaderboard');
  if (!res.ok) throw new Error('could not load leaderboard');
  return (await res.json()) as Leaderboard;
}

export interface ContactSubmission {
  operatorPubKey: string;
  contact: string;
  message: string;
  operatorSig: string;
}

/** Submit an opt-in candidate contact. The caller signs the canonical challenge
 *  (see history.ts) so the server can prove key custody and re-check eligibility. */
export async function submitContact(body: ContactSubmission): Promise<void> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'could not submit contact'));
}

export async function fetchSessionDetail(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'could not load session'));
  return (await res.json()) as SessionDetail;
}

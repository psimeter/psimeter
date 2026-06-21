import { MerkleAccumulator, sessionZ, type LedgerEntry, type WitnessAttestation } from '@psymeter/core';
import type { WebSocket } from 'ws';
import type { LedgerStore } from '../ledgerStore.js';
import type { SessionContext } from '../session.js';
import type { WitnessClient } from '../witnessClient.js';
import { writeBlob } from '../blobStore.js';
import { safeSend } from '../wsSend.js';

/** The integer parameters of a `micro-pk-binary` experiment (spec D13). */
export interface BinaryParams {
  trialBits: number;
  bitRatePerSec: number;
  sessionSeconds: number;
  trialsPerSession: number;
  bitsPerSession: number;
  checkpointEveryTrials: number;
  intentionAssignment: string;
  conditioning: string;
}

export interface Checkpoint {
  trial: number;
  ones: number;
  total: number;
  zDisplay: number;
  root: string;
}

/** A checkpoint persisted in the seal with its live witness co-signatures (D16). */
export interface WitnessedCheckpoint {
  trial: number;
  root: string;
  witness: WitnessAttestation[];
}

/** Read a session context's frozen params as micro-PK's integer parameter set. */
export function microPkParams(ctx: SessionContext): BinaryParams {
  return ctx.params as unknown as BinaryParams;
}

/**
 * Drive a micro-PK session over the one-way WebSocket: send `started`, stream
 * checkpoints during generation, then the seal. The server reads NOTHING from
 * the socket — isolation is structural (pillar 5). Dispatched by app.ts when
 * `experiment.kind === 'micro-pk-binary'`.
 *
 * When a witness is configured (D16), each checkpoint root is co-signed live by
 * the independent witness(es); the sealed `outputCommitment` is the continuation
 * of those witnessed prefixes (recomputable from the raw blob), so the server
 * cannot privately roll several streams and seal the flattering one.
 */
export function streamMicroPk(
  ws: WebSocket,
  ctx: SessionContext,
  store: LedgerStore,
  witness: WitnessClient,
  opts: { blobDir: string; fast: boolean },
): void {
  // One-way isolation: ignore anything the client sends during generation.
  ws.on('message', () => {});

  const p = microPkParams(ctx);
  const trialsPerSec = p.bitRatePerSec / p.trialBits;
  const tickMs = opts.fast ? 0 : Math.round((1000 * p.checkpointEveryTrials) / trialsPerSec);

  safeSend(ws, { type: 'started', tickMs, sessionSeconds: p.sessionSeconds, witnessed: witness.enabled });

  generateAndSeal(ctx, store, witness, {
    tickMs,
    blobDir: opts.blobDir,
    onCheckpoint: (c) => safeSend(ws, { type: 'checkpoint', ...c }),
  })
    .then((seal) => {
      const payload = seal.payload as { ones: number; nSamples: number; outputCommitment: string; rawBlobRef: string; witnessed?: boolean };
      safeSend(ws, {
        type: 'seal',
        sessionId: ctx.sessionId,
        anchor: ctx.anchor,
        ones: payload.ones,
        nSamples: payload.nSamples,
        outputCommitment: payload.outputCommitment,
        rawBlobRef: payload.rawBlobRef,
        openEntryHash: ctx.open!.entryHash,
        sealEntryHash: seal.entryHash,
        witnessed: payload.witnessed ?? false,
      });
    })
    .catch((err) => safeSend(ws, { type: 'error', message: String(err) }))
    .finally(() => ws.close());
}

/**
 * Phases B + C — isolated generation with a streaming Merkle commitment, then
 * seal (spec §7.2). One Merkle leaf is committed per checkpoint window.
 *
 * `tickMs` paces the stream for the human experience only; it is NOT a committed
 * parameter and does not affect the statistics (spec §8.6).
 */
export async function generateAndSeal(
  ctx: SessionContext,
  store: LedgerStore,
  witness: WitnessClient,
  opts: { tickMs: number; blobDir: string; onCheckpoint: (c: Checkpoint) => void },
): Promise<LedgerEntry> {
  if (!ctx.open) throw new Error('session has not been signed/opened');
  const p = microPkParams(ctx);
  if (p.trialBits % 8 !== 0) throw new Error('trialBits must be a multiple of 8');
  const bytesPerTrial = p.trialBits / 8;

  // Independent witness co-signs the session start (the witness feed then carries
  // every started session, so the auditor can detect started-but-unsealed runs).
  const openWitness = witness.enabled
    ? await witness.attestQuorum({ subjectHash: ctx.open.entryHash, sessionId: ctx.sessionId, kind: 'open' })
    : [];

  const merkle = new MerkleAccumulator();
  const chunks: Uint8Array[] = [];
  const checkpoints: WitnessedCheckpoint[] = [];
  let ones = 0;
  let total = 0;
  let trial = 0;

  while (trial < p.trialsPerSession) {
    const batchTrials = Math.min(p.checkpointEveryTrials, p.trialsPerSession - trial);
    const block = await ctx.source.read(batchTrials * bytesPerTrial);
    merkle.add(block); // commit to this checkpoint window's raw bytes
    chunks.push(block); // retain the raw bytes — they ARE the record (D2)
    for (const byte of block) ones += popcount(byte);
    trial += batchTrials;
    total += batchTrials * p.trialBits;

    const root = merkle.root();
    opts.onCheckpoint({ trial, ones, total, zDisplay: sessionZ(ones, total), root });
    // Live witnessing (D16): co-sign this checkpoint prefix root before the next
    // one exists, binding the witness's own fresh beacon round.
    if (witness.enabled) {
      const att = await witness.attestQuorum({ subjectHash: root, sessionId: ctx.sessionId, kind: 'checkpoint' });
      checkpoints.push({ trial, root, witness: att });
    }
    if (opts.tickMs > 0 && trial < p.trialsPerSession) await sleep(opts.tickMs);
  }

  // Persist the full raw stream, content-addressed, for independent re-analysis
  // and verification against the commitments (spec §7.2, D2).
  const blob = writeBlob(opts.blobDir, concatBytes(chunks));
  const outputCommitment = merkle.root();

  const payload: Record<string, unknown> = {
    sessionId: ctx.sessionId,
    openEntryHash: ctx.open.entryHash,
    outputCommitment,
    rawSha256: blob.sha256,
    rawBlobRef: blob.ref,
    leafBytes: (p.checkpointEveryTrials * p.trialBits) / 8, // Merkle leaf size, for re-verification
    nSamples: total,
    ones,
  };

  // Witness fields are ADDITIVE and present only when witnessing is on, so a
  // non-witnessed seal is byte-identical to the pre-D16 format (back-compat).
  if (witness.enabled) {
    const sealWitness = await witness.attestQuorum({ subjectHash: outputCommitment, sessionId: ctx.sessionId, kind: 'seal' });
    const keys = distinctKeys([...openWitness, ...sealWitness, ...checkpoints.flatMap((c) => c.witness)]);
    payload.witnessed = true;
    payload.witness = { threshold: witness.threshold, keys, open: openWitness, seal: sealWitness };
    payload.checkpoints = checkpoints;
  }

  return store.append('session.seal', payload);
}

function distinctKeys(atts: WitnessAttestation[]): string[] {
  return [...new Set(atts.map((a) => a.witnessPubKey))];
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function popcount(b: number): number {
  let n = b;
  let c = 0;
  while (n) {
    c += n & 1;
    n >>= 1;
  }
  return c;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

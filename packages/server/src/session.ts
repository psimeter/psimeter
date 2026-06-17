import { randomBytes, randomUUID } from 'node:crypto';
import {
  buildPrecommit,
  experimentHash,
  GENESIS_PREV,
  MerkleAccumulator,
  sessionZ,
  type BeaconRef,
  type EntropySource,
  type ExperimentDefinition,
  type Intention,
  type LedgerEntry,
} from '@psymeter/core';
import type { LedgerStore } from './ledgerStore.js';

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

/** Live, in-memory state for one session between pre-commit and seal. */
export interface SessionContext {
  sessionId: string;
  experiment: ExperimentDefinition;
  params: BinaryParams;
  intention: Intention;
  beacon: BeaconRef;
  operatorPubKey: string;
  source: EntropySource;
  serverNonce: string;
  prevHash: string;
  precommit: string;
  anchor: string;
  /** The committed `session.open` entry — null until the operator signs (D6). */
  open: LedgerEntry | null;
  started: boolean;
}

export interface PrepareArgs {
  experiment: ExperimentDefinition;
  intention: Intention;
  operatorPubKey: string;
  beacon: BeaconRef;
  source: EntropySource;
}

/**
 * Phase A (part 1) — build the pre-commitment and anchor, BEFORE any randomness
 * exists (spec §7.2). The `session.open` entry is NOT logged yet: it is held
 * until the operator signs `precommit` (see commitOpen), so the ledger only ever
 * records signed sessions.
 */
export function prepareSession(store: LedgerStore, args: PrepareArgs): SessionContext {
  const { experiment, intention, operatorPubKey, beacon, source } = args;
  const params = experiment.params as unknown as BinaryParams;
  const sessionId = randomUUID();
  const serverNonce = randomBytes(16).toString('hex');
  const prevHash = store.currentHead ? store.currentHead.entryHash : GENESIS_PREV;

  const { precommit, anchor } = buildPrecommit({
    experimentId: experiment.id,
    experimentVersion: experiment.version,
    experimentHash: experimentHash(experiment),
    intention,
    operatorPubKey,
    beacon,
    sessionId,
    serverNonce,
    prevHash,
  });

  return { sessionId, experiment, params, intention, beacon, operatorPubKey, source, serverNonce, prevHash, precommit, anchor, open: null, started: false };
}

/**
 * Phase A (part 2) — having verified the operator's signature over `precommit`,
 * append the immutable `session.open` entry (with the operator's key + signature)
 * to the ledger. Guards that the ledger head has not advanced since prepare, so
 * the committed entry's `prevHash` matches the one bound into `precommit`.
 */
export function commitOpen(store: LedgerStore, ctx: SessionContext, operatorSig: string): LedgerEntry {
  const headHash = store.currentHead ? store.currentHead.entryHash : GENESIS_PREV;
  if (headHash !== ctx.prevHash) {
    throw new Error('ledger advanced between prepare and sign; retry the session');
  }
  const open = store.append('session.open', {
    sessionId: ctx.sessionId,
    experimentId: ctx.experiment.id,
    experimentVersion: ctx.experiment.version,
    intention: ctx.intention,
    operatorPubKey: ctx.operatorPubKey,
    operatorSig,
    beacon: ctx.beacon,
    entropySource: {
      id: ctx.source.id,
      kind: ctx.source.kind,
      confirmatory: ctx.source.confirmatory,
      metadata: ctx.source.metadata,
    },
    serverNonce: ctx.serverNonce,
    precommit: ctx.precommit,
    anchor: ctx.anchor,
  });
  ctx.open = open;
  return open;
}

export interface Checkpoint {
  trial: number;
  ones: number;
  total: number;
  zDisplay: number;
  root: string;
}

/**
 * Phases B + C — isolated generation with a streaming Merkle commitment, then
 * seal (spec §7.2). Reads NOTHING from the client (one-way isolation, pillar 5).
 * One Merkle leaf is committed per checkpoint window.
 *
 * `tickMs` paces the stream for the human experience only; it is NOT a committed
 * parameter and does not affect the statistics (spec §8.6).
 */
export async function generateAndSeal(
  ctx: SessionContext,
  store: LedgerStore,
  opts: { tickMs: number; onCheckpoint: (c: Checkpoint) => void },
): Promise<LedgerEntry> {
  if (!ctx.open) throw new Error('session has not been signed/opened');
  const p = ctx.params;
  if (p.trialBits % 8 !== 0) throw new Error('trialBits must be a multiple of 8');
  const bytesPerTrial = p.trialBits / 8;

  const merkle = new MerkleAccumulator();
  let ones = 0;
  let total = 0;
  let trial = 0;

  while (trial < p.trialsPerSession) {
    const batchTrials = Math.min(p.checkpointEveryTrials, p.trialsPerSession - trial);
    const block = await ctx.source.read(batchTrials * bytesPerTrial);
    merkle.add(block); // commit to this checkpoint window's raw bytes
    for (const byte of block) ones += popcount(byte);
    trial += batchTrials;
    total += batchTrials * p.trialBits;

    opts.onCheckpoint({ trial, ones, total, zDisplay: sessionZ(ones, total), root: merkle.root() });
    if (opts.tickMs > 0 && trial < p.trialsPerSession) await sleep(opts.tickMs);
  }

  return store.append('session.seal', {
    sessionId: ctx.sessionId,
    openEntryHash: ctx.open.entryHash,
    outputCommitment: merkle.root(),
    nSamples: total,
    ones,
    // TODO: checkpoints[], rawBlobRef (content-addressed raw-stream persistence).
  });
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

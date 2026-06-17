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
  open: LedgerEntry;
  precommit: string;
  anchor: string;
  started: boolean;
}

export interface OpenArgs {
  experiment: ExperimentDefinition;
  intention: Intention;
  operatorPubKey: string;
  beacon: BeaconRef;
  source: EntropySource;
}

/**
 * Phase A — pre-commitment (spec §7.2). Builds the commitment + anchor and
 * appends the `session.open` ledger entry, BEFORE any randomness exists. The
 * operator receives the anchor immediately; generation does not begin until they
 * connect to watch (see generateAndSeal).
 */
export function openSession(store: LedgerStore, args: OpenArgs): SessionContext {
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

  const open = store.append('session.open', {
    sessionId,
    experimentId: experiment.id,
    experimentVersion: experiment.version,
    intention,
    operatorPubKey,
    beacon,
    entropySource: {
      id: source.id,
      kind: source.kind,
      confirmatory: source.confirmatory,
      metadata: source.metadata,
    },
    serverNonce,
    precommit,
    anchor,
    // TODO(D6): operatorSig — the operator signs `precommit` client-side.
  });

  return { sessionId, experiment, params, intention, beacon, operatorPubKey, source, open, precommit, anchor, started: false };
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

import { randomBytes, randomUUID } from 'node:crypto';
import {
  buildPrecommit,
  experimentHash,
  GENESIS_PREV,
  type BeaconRef,
  type Choice,
  type EntropySource,
  type ExperimentDefinition,
  type LedgerEntry,
} from '@psimeter/core';
import type { LedgerStore } from './ledgerStore.js';

/**
 * The shared, kind-agnostic session spine (spec §7.2): build the pre-commitment
 * and anchor before any randomness exists, then — once the operator has signed —
 * append the immutable `session.open` entry. The kind-specific generation /
 * reveal protocol and seal live in `kinds/*` (e.g. kinds/microPk.ts), dispatched
 * by `experiment.kind` in app.ts.
 */

/** Live, in-memory state for one session between pre-commit and seal. */
export interface SessionContext {
  sessionId: string;
  experiment: ExperimentDefinition;
  /** The frozen, content-hashed parameter set (kind casts to its own shape). */
  params: Record<string, unknown>;
  /** The session-level committed choice (micro-PK intention; '' for kinds whose
   * choices are per-trial, e.g. precognition). */
  intention: Choice;
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
  intention: Choice;
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
  const params = experiment.params;
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

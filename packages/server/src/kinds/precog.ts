import {
  MerkleAccumulator,
  canonicalize,
  choiceVocabulary,
  derivePrecogTarget,
  trialCommit,
} from '@psymeter/core';
import type { WebSocket, RawData } from 'ws';
import type { LedgerStore } from '../ledgerStore.js';
import type { SessionContext } from '../session.js';
import type { BeaconProvider } from '../beacon.js';
import { verifyEd25519 } from '../sign.js';
import { writeBlob } from '../blobStore.js';
import { safeSend } from '../wsSend.js';

/** Frozen integer parameters of a `precognition-presentiment` experiment. */
interface PrecogParams {
  sessionSeconds: number;
  trialsPerSession: number;
  optionsPerTrial: number;
  beaconRoundOffset: number;
}

/** One persisted trial — the content-addressed record an auditor re-verifies. */
interface TrialRecord {
  trialIndex: number;
  choice: string;
  targetRound: number;
  prevBeaconRound: number;
  beaconValue: string;
  beaconSignature?: string;
  target: number;
  hit: number; // 0 | 1 (integer for canonical parity)
  operatorSig: string;
}

/**
 * Run a presentiment session over a TWO-WAY WebSocket (spec §7.5). Per trial:
 *
 *   1. server → `trial`   (the operator now feels/chooses; no target exists yet)
 *   2. client → `choice`  (the chosen option; the moment of decision)
 *   3. server → `pending` (assigns a FUTURE round R = latest + offset, and R0)
 *   4. client → `sign`    (Ed25519 over trialCommit{choice,R,R0,…})
 *   5. server → `reveal`  (waits for R, derives target from B_R, scores the hit)
 *
 * Two-way comms is sound here precisely because the target is bound to a beacon
 * round that has not been published — neither operator nor server can know it at
 * choice time, so there is no channel to game (contrast micro-PK's one-way
 * isolation). Each trial's choice is operator-signed before R publishes, so the
 * whole session is re-verifiable from the public beacon with no trust in us.
 */
export function streamPrecog(
  ws: WebSocket,
  ctx: SessionContext,
  store: LedgerStore,
  beacon: BeaconProvider,
  opts: { blobDir: string },
): void {
  const p = ctx.params as unknown as PrecogParams;
  const vocab = choiceVocabulary(ctx.experiment);
  const merkle = new MerkleAccumulator();
  const records: TrialRecord[] = [];
  let hits = 0;
  let trialIndex = 0;
  let pending: { targetRound: number; prevBeaconRound: number; choice: string } | null = null;
  let closed = false;

  safeSend(ws, {
    type: 'started',
    trialsPerSession: p.trialsPerSession,
    optionsPerTrial: p.optionsPerTrial,
    sessionSeconds: p.sessionSeconds,
    beaconSource: beacon.id,
  });

  function fail(message: string): void {
    if (closed) return;
    closed = true;
    safeSend(ws, { type: 'error', message });
    ws.close();
  }

  function nextTrial(): void {
    pending = null;
    if (trialIndex >= p.trialsPerSession) { void seal(); return; }
    safeSend(ws, { type: 'trial', trialIndex });
  }

  async function onChoice(m: { trialIndex: number; choice: string }): Promise<void> {
    if (pending || m.trialIndex !== trialIndex) return; // ignore stale/duplicate
    const choice = String(m.choice);
    if (!vocab.includes(choice)) { fail(`invalid choice "${choice}"`); return; }
    // Bind a FUTURE round only after the operator has committed their choice.
    const latest = await beacon.fetchPulse();
    const prevBeaconRound = latest.round;
    const targetRound = prevBeaconRound + p.beaconRoundOffset;
    pending = { targetRound, prevBeaconRound, choice };
    safeSend(ws, { type: 'pending', trialIndex, targetRound, prevBeaconRound });
  }

  async function onSign(m: { trialIndex: number; operatorSig: string }): Promise<void> {
    if (!pending || m.trialIndex !== trialIndex) return;
    const { targetRound, prevBeaconRound, choice } = pending;
    const tc = trialCommit({
      sessionId: ctx.sessionId,
      trialIndex,
      choice,
      targetRound,
      prevBeaconRound,
      operatorPubKey: ctx.operatorPubKey,
    });
    if (!verifyEd25519(ctx.operatorPubKey, tc, String(m.operatorSig))) {
      fail('invalid trial signature');
      return;
    }
    // Timing guard: the signed choice must arrive before the target publishes.
    // (An untrusted server could still backdate this — the residual §7.4 timing
    // attack, closed only by live witnesses in Phase 3.)
    const now = await beacon.fetchPulse();
    if (now.round >= targetRound) { fail('trial timing violation: target already public'); return; }

    const b = await beacon.waitForRound(targetRound);
    const target = derivePrecogTarget(b.value, trialIndex, p.optionsPerTrial);
    const hit = vocab.indexOf(choice) === target ? 1 : 0;
    hits += hit;

    const rec: TrialRecord = {
      trialIndex, choice, targetRound, prevBeaconRound, beaconValue: b.value, target, hit, operatorSig: String(m.operatorSig),
    };
    if (b.signature) rec.beaconSignature = b.signature;
    records.push(rec);
    merkle.add(new TextEncoder().encode(canonicalize(rec)));

    safeSend(ws, {
      type: 'reveal',
      trialIndex,
      choice,
      target,
      targetChoice: vocab[target],
      hit,
      beaconRound: targetRound,
      beaconValue: b.value,
      hits,
      completed: trialIndex + 1,
      trialsPerSession: p.trialsPerSession,
    });
    trialIndex += 1;
    nextTrial();
  }

  async function seal(): Promise<void> {
    if (closed) return;
    closed = true;
    const blob = writeBlob(opts.blobDir, new TextEncoder().encode(canonicalize(records)));
    const sealEntry = store.append('session.seal', {
      sessionId: ctx.sessionId,
      openEntryHash: ctx.open!.entryHash,
      outputCommitment: merkle.root(),
      rawSha256: blob.sha256,
      rawBlobRef: blob.ref,
      trials: records.length,
      hits,
      optionsPerTrial: p.optionsPerTrial,
    });
    const sp = sealEntry.payload as { outputCommitment: string };
    safeSend(ws, {
      type: 'seal',
      sessionId: ctx.sessionId,
      anchor: ctx.anchor,
      hits,
      trials: records.length,
      optionsPerTrial: p.optionsPerTrial,
      outputCommitment: sp.outputCommitment,
      rawBlobRef: blob.ref,
      openEntryHash: ctx.open!.entryHash,
      sealEntryHash: sealEntry.entryHash,
    });
    ws.close();
  }

  ws.on('message', (data: RawData) => {
    let m: { type?: string; trialIndex?: number; choice?: string; operatorSig?: string };
    try { m = JSON.parse(data.toString()) as typeof m; } catch { return; }
    if (m.type === 'choice') void onChoice(m as { trialIndex: number; choice: string }).catch((e) => fail(String(e)));
    else if (m.type === 'sign') void onSign(m as { trialIndex: number; operatorSig: string }).catch((e) => fail(String(e)));
  });

  nextTrial();
}

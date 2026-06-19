/**
 * Forced-choice precognition (presentiment) primitives (spec §7.5).
 *
 * The operator commits a choice BEFORE the target exists, binding it to a
 * *future* public-beacon round R. Once R publishes, the target is derived purely
 * from its randomness `B_R` — deterministic, public, and reproducible by anyone,
 * with no trust in the server (the chosen design: future-drand-round only).
 *
 * Every function here is pure and is mirrored byte-for-byte in
 * analysis/analyze.py (and re-run in the browser /verify view), so a skeptic can
 * reproduce each trial's target and hit independently.
 */
import { sha256Bytes } from './hash.js';
import { commitHash } from './commitment.js';
import type { Choice } from './types.js';

/**
 * The per-trial commitment input. The operator signs `trialCommit(input)` before
 * round `targetRound` publishes. `prevBeaconRound` is the latest published round
 * at commit time — a freshness lower bound proving the choice came after it
 * (combined with targetRound > prevBeaconRound proving the target was future).
 */
export interface TrialCommitInput {
  sessionId: string;
  trialIndex: number;
  choice: Choice;
  targetRound: number;
  prevBeaconRound: number;
  operatorPubKey: string;
}

/** Content commitment over a trial's pre-choice (canonical SHA-256, "sha256:…"). */
export function trialCommit(input: TrialCommitInput): string {
  return commitHash(input);
}

/**
 * Derive a trial's target option index from the future beacon value `B_R`.
 *
 *   target = uint64_be( SHA256( bytes(B_R) ‖ uint32_be(trialIndex) )[:8] ) mod k
 *
 * Domain-separating by `trialIndex` lets one round seed independent trials if
 * ever needed; in the live protocol each trial binds its own round. `k` is the
 * number of options per trial (≥ 2).
 */
export function derivePrecogTarget(beaconValueHex: string, trialIndex: number, optionsPerTrial: number): number {
  if (optionsPerTrial < 2) throw new Error('optionsPerTrial must be >= 2');
  const msg = concatBytes(hexToBytes(beaconValueHex), uint32BE(trialIndex));
  const digest = sha256Bytes(msg);
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(digest[i]!);
  return Number(v % BigInt(optionsPerTrial));
}

function uint32BE(n: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (n >>> 24) & 0xff;
  out[1] = (n >>> 16) & 0xff;
  out[2] = (n >>> 8) & 0xff;
  out[3] = n & 0xff;
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('odd-length hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

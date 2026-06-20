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

/** What a presentiment trial's future beacon round destines the operator to see. */
export interface PresentimentTarget {
  /** 0 = calm (positive), 1 = aversive (negative) — a fair coin, see below. */
  valence: number;
  /** Index into that valence's stimulus pool (the specific image shown). */
  imageIndex: number;
}

/**
 * Derive which stimulus a presentiment trial will reveal, from the future beacon
 * value `B_R` (spec §7.5). Pure and reproducible by anyone:
 *
 *   digest     = SHA256( bytes(B_R) ‖ uint32_be(trialIndex) )
 *   valence    = digest[0] & 1                         // 0=calm, 1=aversive
 *   imageIndex = uint64_be(digest[8:16]) mod poolSize  // within that valence
 *
 * Valence is taken from a single bit so it is an EXACT fair coin (p = 0.5)
 * regardless of how many images sit in each pool; the image is then chosen from a
 * disjoint slice of the digest. `calmCount`/`aversiveCount` are the pool sizes
 * from the (content-hashed) experiment definition, so the selected image is
 * pinned by the definition hash.
 */
export function derivePresentimentTarget(
  beaconValueHex: string,
  trialIndex: number,
  calmCount: number,
  aversiveCount: number,
): PresentimentTarget {
  const digest = sha256Bytes(concatBytes(hexToBytes(beaconValueHex), uint32BE(trialIndex)));
  const valence = digest[0]! & 1;
  const poolSize = valence === 0 ? calmCount : aversiveCount;
  if (poolSize <= 0) throw new Error('empty stimulus pool');
  let v = 0n;
  for (let i = 8; i < 16; i++) v = (v << 8n) | BigInt(digest[i]!);
  return { valence, imageIndex: Number(v % BigInt(poolSize)) };
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

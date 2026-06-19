import { canonicalize } from './canonicalize.js';
import { sha256, hexOf } from './hash.js';
import type { BeaconRef, Choice } from './types.js';

/**
 * Inputs frozen at session start, before any randomness exists (spec §7.2).
 * The experiment's exact parameter set is bound by `experimentHash` (D13), so
 * the commitment pins the parameters without inlining them.
 */
export interface PrecommitInput {
  experimentId: string;
  experimentVersion: number;
  experimentHash: string;
  /**
   * The committed operator decision. The JSON key stays `intention` so the
   * canonical bytes (and therefore every existing micro-PK precommit hash) are
   * unchanged; the TYPE is widened to a generic `Choice` so other kinds can
   * commit their own option ids here (spec §10).
   */
  intention: Choice;
  operatorPubKey: string; // ed25519 public key — pseudonymous identity (D6)
  beacon: BeaconRef; // freshness anchor (§7)
  sessionId: string;
  serverNonce: string;
  prevHash: string; // ledger head at commit time
}

export interface Precommit {
  /** "sha256:…" over the canonical PrecommitInput. */
  precommit: string;
  /** Short, human-readable encoding of the commitment, shown to the operator. */
  anchor: string;
}

/**
 * Build the pre-commitment and the human "anchor".
 *
 * The anchor is derived from the COMMITMENT (not from a seed), so it binds
 * intention + parameters + identity + freshness all at once (spec §7.2). The
 * operator records it as independent proof of exactly what they committed to.
 */
export function buildPrecommit(input: PrecommitInput): Precommit {
  const precommit = sha256(canonicalize(input));
  return { precommit, anchor: anchorFromHash(precommit) };
}

/**
 * Generic content commitment: the canonical-JSON SHA-256 of any committable
 * value ("sha256:…"). Used for sub-session commitments that are not the full
 * session pre-commitment — e.g. a precognition trial binds its choice to a
 * future beacon round (spec §7.5) and signs THIS hash before the target exists.
 * The value MUST satisfy the canonicalize profile (integers/strings only).
 */
export function commitHash(value: unknown): string {
  return sha256(canonicalize(value));
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base32, no I/L/O/U

/**
 * Encode the first 60 bits of a commitment as a 12-character Crockford base32
 * anchor, grouped `XXXX-XXXX-XXXX`. Deterministic and case-insensitive.
 */
export function anchorFromHash(prefixedHash: string): string {
  const hex = hexOf(prefixedHash).slice(0, 15); // 60 bits
  let bits = '';
  for (const c of hex) bits += parseInt(c, 16).toString(2).padStart(4, '0');
  let out = '';
  for (let i = 0; i < 60; i += 5) out += CROCKFORD[parseInt(bits.slice(i, i + 5), 2)];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

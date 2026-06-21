/**
 * Live-witness primitives (spec §7.4, D16).
 *
 * A *witness* is an independent process (its own Ed25519 key, host, operator)
 * that co-signs an artifact in real time, binding a fresh public-beacon round it
 * fetched and verified ITSELF as the time anchor. Witnesses close the two
 * residual attacks an untrusted server still has:
 *   - micro-PK "parallel runs": the witness co-signs the live checkpoint roots,
 *     so the sealed stream must be the one that was streamed/witnessed live;
 *   - precognition backdating: the witness co-signs each forced-choice commit
 *     while its target beacon round is still in the FUTURE (witnessRound <
 *     targetRound), so the choice provably precedes the target.
 *
 * This module is the pure, audited home of the canonical statement a witness
 * signs and the (structural) quorum rule auditors apply. As with the operator
 * pre-commitment, the SIGNATURE math lives where the runtime keys do (node:crypto
 * on the server/witness, @noble in the browser, `cryptography` in analyze.py) —
 * core only fixes the exact bytes and counts a threshold, so every verifier
 * reproduces the same statement and the same verdict.
 */
import { canonicalize } from './canonicalize.js';
import { sha256 } from './hash.js';

/** What an attestation is *about* — drives the verifier's per-kind timing rule. */
export type WitnessSubjectKind = 'open' | 'checkpoint' | 'choice' | 'seal';

/**
 * The exact, canonical content a witness signs (integers/strings only, so
 * analysis/analyze.py and the browser /verify reproduce it byte-for-byte). The
 * `subjectHash` is the artifact being witnessed — a streaming Merkle checkpoint
 * root (micro-PK), a `trialCommit` (precognition choice), the `openEntryHash`, or
 * the seal's `outputCommitment`. `witnessRound` is bound INSIDE the signed bytes
 * so the time anchor cannot be detached from the attestation.
 */
export interface WitnessStatementInput {
  subjectHash: string;
  sessionId: string;
  /** Present only for per-trial subjects (precognition `choice`); omitted otherwise. */
  trialIndex?: number;
  kind: WitnessSubjectKind;
  /** The beacon round the witness fetched + verified itself (its time anchor). */
  witnessRound: number;
  /** The beacon chain id the round belongs to (pins which beacon, e.g. quicknet). */
  witnessChainHash: string;
  /** The co-signing witness's Ed25519 public key — its pseudonymous identity. */
  witnessPubKey: string;
}

/**
 * The bytes a witness signs ("sha256:…" over the canonical statement). Pure and
 * mirrored in every verifier. `trialIndex` is omitted when undefined (canonicalize
 * drops undefined keys), so session-level statements and per-trial statements have
 * distinct, unambiguous forms.
 */
export function witnessStatement(input: WitnessStatementInput): string {
  return sha256(canonicalize(input));
}

/**
 * One witness's co-signature over a subject, as stored on the artifact (and,
 * authoritatively, in the witness's own append-only feed). The verifier
 * recomputes `witnessStatement` from the artifact's context (subjectHash,
 * sessionId, trialIndex, kind) plus the round/chain/key carried here, then checks
 * `witnessSig` against `witnessPubKey`.
 */
export interface WitnessAttestation {
  witnessPubKey: string;
  witnessRound: number;
  witnessChainHash: string;
  /** Ed25519 signature ("ed25519:…") over witnessStatement(...). */
  witnessSig: string;
  /** This attestation's position in the witness's own feed (for the drop cross-check). */
  feedSeq?: number;
  /** The witness feed entry's hash, so the inline copy and the feed are bound. */
  feedEntryHash?: string;
}

/**
 * Auditor-supplied trust policy. The set of trusted witness keys is NOT taken
 * from the server (which is untrusted) — it is the auditor's own list of known
 * independent witnesses (published in the repo, like the hardcoded drand group
 * key). `threshold` is the minimum number of DISTINCT trusted witnesses required
 * (M of N). For confirmatory use this may additionally be pinned in the
 * hash-bound experiment definition (D13), but it is always an auditor input here.
 */
export interface WitnessQuorumPolicy {
  trustedKeys: string[];
  threshold: number;
}

export interface WitnessQuorumResult {
  ok: boolean;
  /** Distinct trusted witness keys among the (already signature-verified) inputs. */
  distinctTrusted: number;
  reason?: string;
}

/**
 * Structural quorum count ONLY — the caller passes the subset of attestations
 * whose signatures it has ALREADY verified (signature math is environment-
 * specific, exactly as pre-commitment verification is split today). Counts the
 * distinct trusted keys and compares to the threshold; never trusts the server's
 * say-so about who witnessed.
 */
export function witnessQuorum(
  verifiedAttestations: readonly WitnessAttestation[],
  policy: WitnessQuorumPolicy,
): WitnessQuorumResult {
  const trusted = new Set(policy.trustedKeys);
  const distinct = new Set<string>();
  for (const a of verifiedAttestations) {
    if (trusted.has(a.witnessPubKey)) distinct.add(a.witnessPubKey);
  }
  const distinctTrusted = distinct.size;
  if (policy.threshold < 1) {
    return { ok: false, distinctTrusted, reason: 'threshold must be ≥ 1' };
  }
  if (distinctTrusted < policy.threshold) {
    return {
      ok: false,
      distinctTrusted,
      reason: `need ${policy.threshold} distinct trusted witness(es), have ${distinctTrusted}`,
    };
  }
  return { ok: true, distinctTrusted };
}

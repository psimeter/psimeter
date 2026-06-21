// In-browser session verification (spec §7.3) — the "don't trust us" feature.
//
// Given a session's revealed fields (its open + seal ledger entries plus the
// experiment definition), this recomputes the pre-commitment and anchor from
// first principles, checks the hash-chain entry hashes, and verifies the
// operator's Ed25519 signature — all in the browser, using the SAME pure
// @psimeter/core that the server and analysis/analyze.py use. Nothing here trusts
// the server's word for anything; every value is recomputed locally.
//
// (The raw-bit Merkle root is verified against the multi-megabyte raw blob in
// analysis/analyze.py; the in-browser checks cover everything except that blob.)

import {
  buildPrecommit,
  experimentHash,
  hashEntry,
  canonicalize,
  sha256,
  MerkleAccumulator,
  derivePresentimentTarget,
  trialCommit,
  choiceVocabulary,
  witnessStatement,
} from '@psimeter/core';
import * as ed from '@noble/ed25519';
import type { OpenPayload, SealPayload, SessionDetail, WitnessAttestation } from './api';

type WitnessSubjectKind = 'open' | 'checkpoint' | 'choice' | 'seal';

export interface Check {
  label: string;
  ok: boolean;
  note?: string;
}

export async function verifySession(detail: SessionDetail): Promise<Check[]> {
  const checks: Check[] = [];
  const { open, seal, experiment } = detail;
  const o = open.payload as OpenPayload;

  // The open entry's own hash (over seq, ts, prevHash, type, payload).
  checks.push({ label: 'Open entry hash is intact', ok: hashEntry(open) === open.entryHash });

  // Recompute the pre-commitment and anchor from the revealed inputs.
  if (experiment) {
    const recomputed = buildPrecommit({
      experimentId: o.experimentId,
      experimentVersion: o.experimentVersion,
      experimentHash: experimentHash(experiment),
      intention: o.intention,
      operatorPubKey: o.operatorPubKey,
      beacon: o.beacon,
      sessionId: o.sessionId,
      serverNonce: o.serverNonce,
      prevHash: open.prevHash,
    });
    checks.push({
      label: 'Pre-commitment recomputed from the revealed fields',
      ok: recomputed.precommit === o.precommit,
      note: o.precommit,
    });
    checks.push({
      label: 'Anchor is derived from the pre-commitment',
      ok: recomputed.anchor === o.anchor,
      note: o.anchor,
    });
  } else {
    checks.push({
      label: 'Pre-commitment recomputed from the revealed fields',
      ok: false,
      note: 'experiment definition unavailable',
    });
  }

  // The operator signed the pre-commitment with their private key.
  checks.push({
    label: 'Operator signature over the pre-commitment is valid',
    ok: await verifySignature(o.operatorPubKey, o.precommit, o.operatorSig),
  });

  // The seal is itself intact and bound back to this exact open entry.
  if (seal) {
    const s = seal.payload as SealPayload;
    checks.push({ label: 'Seal entry hash is intact', ok: hashEntry(seal) === seal.entryHash });
    checks.push({ label: 'Seal binds to this open entry', ok: s.openEntryHash === open.entryHash });

    // Precognition: the small per-trial blob is re-verifiable IN THE BROWSER —
    // each choice was signed and bound to a future beacon round, and every target
    // is re-derived from that round's public randomness (spec §7.5).
    if (typeof s.trials === 'number') {
      await verifyPrecogTrials(checks, o, s, experiment);
    } else if (s.witnessed) {
      // micro-PK: re-check the independent witness co-signatures (spec D16).
      await verifyMicroPkWitness(checks, o, s);
    }
  }

  return checks;
}

/**
 * Verify a list of witness co-signatures over one subject (spec D16): each
 * attestation's Ed25519 signature over the recomputed witnessStatement, plus the
 * choice-before-target timing when a targetRound is given. Returns the distinct
 * keys that verified, so the caller can count an M-of-N quorum.
 */
async function verifyAttestations(
  attestations: WitnessAttestation[] | undefined,
  subjectHash: string,
  sessionId: string,
  kind: WitnessSubjectKind,
  trialIndex?: number,
  targetRound?: number,
): Promise<{ distinct: Set<string>; sigsOk: boolean; timingOk: boolean }> {
  const distinct = new Set<string>();
  let sigsOk = true;
  let timingOk = true;
  for (const a of attestations ?? []) {
    const stmt = witnessStatement({
      subjectHash, sessionId, trialIndex, kind,
      witnessRound: a.witnessRound, witnessChainHash: a.witnessChainHash, witnessPubKey: a.witnessPubKey,
    });
    if (await verifySignature(a.witnessPubKey, stmt, a.witnessSig)) distinct.add(a.witnessPubKey);
    else sigsOk = false;
    if (typeof targetRound === 'number' && a.witnessRound >= targetRound) timingOk = false;
  }
  return { distinct, sigsOk, timingOk };
}

async function verifyMicroPkWitness(checks: Check[], o: OpenPayload, s: SealPayload): Promise<void> {
  const w = s.witness;
  const openRes = await verifyAttestations(w?.open, s.openEntryHash, o.sessionId, 'open');
  const sealRes = await verifyAttestations(w?.seal, s.outputCommitment, o.sessionId, 'seal');
  const cpKeys = new Set<string>();
  let cpSigsOk = true;
  const cps = s.checkpoints ?? [];
  for (const cp of cps) {
    const r = await verifyAttestations(cp.witness, cp.root, o.sessionId, 'checkpoint');
    if (!r.sigsOk) cpSigsOk = false;
    r.distinct.forEach((k) => cpKeys.add(k));
  }
  const distinct = new Set<string>([...openRes.distinct, ...sealRes.distinct, ...cpKeys]);
  const threshold = w?.threshold ?? 1;
  checks.push({
    label: `Independent witness co-signed the session start, all ${cps.length} live checkpoints, and the seal`,
    ok: cpSigsOk && openRes.sigsOk && sealRes.sigsOk && cps.length > 0 && openRes.distinct.size > 0 && sealRes.distinct.size > 0,
    note: 'that these checkpoint roots are the real raw-stream prefixes is re-checked from the blob in analysis/analyze.py',
  });
  checks.push({
    label: `At least ${threshold} independent witness(es) co-signed (quorum)`,
    ok: distinct.size >= threshold,
    note: `${distinct.size} distinct witness key(s)`,
  });
}

interface TrialRecord {
  trialIndex: number;
  choice: string;
  targetRound: number;
  prevBeaconRound: number;
  beaconValue: string;
  beaconSignature?: string;
  valence: number;
  imagePath: string;
  imageSha256: string;
  hit: number;
  operatorSig: string;
  witness?: WitnessAttestation[];
}

interface Stimulus { path: string; sha256: string; }

async function verifyPrecogTrials(
  checks: Check[],
  o: OpenPayload,
  s: SealPayload,
  experiment: SessionDetail['experiment'],
): Promise<void> {
  let records: TrialRecord[];
  let bytes: Uint8Array;
  try {
    const res = await fetch(`/${s.rawBlobRef}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
    records = JSON.parse(new TextDecoder().decode(bytes)) as TrialRecord[];
  } catch (e) {
    checks.push({ label: 'Per-trial records fetched and verified', ok: false, note: `could not load raw blob: ${String(e)}` });
    return;
  }

  const vocab = experiment ? choiceVocabulary(experiment) : [];
  const stimuli = (experiment?.stimuli ?? {}) as Record<string, Stimulus[]>;
  const pools: Stimulus[][] = [stimuli[vocab[0]!] ?? [], stimuli[vocab[1]!] ?? []];
  const haveCorpus = pools[0]!.length > 0 && pools[1]!.length > 0;

  const merkle = new MerkleAccumulator();
  let sigsOk = true;
  let futureOk = true;
  let derivedOk = true; // valence + selected image re-derive from the beacon
  let hitsOk = true;
  // Live-witness accumulation (spec D16): each choice co-signed before its target.
  let witnessSigsOk = true;
  let witnessTimingOk = true;
  let witnessedTrials = 0;
  const witnessKeys = new Set<string>();

  for (const r of records) {
    merkle.add(new TextEncoder().encode(canonicalize(r)));
    const tc = trialCommit({
      sessionId: o.sessionId,
      trialIndex: r.trialIndex,
      choice: r.choice,
      targetRound: r.targetRound,
      prevBeaconRound: r.prevBeaconRound,
      operatorPubKey: o.operatorPubKey,
    });
    if (!(await verifySignature(o.operatorPubKey, tc, r.operatorSig))) sigsOk = false;
    if (r.witness?.length) {
      witnessedTrials += 1;
      const wr = await verifyAttestations(r.witness, tc, o.sessionId, 'choice', r.trialIndex, r.targetRound);
      if (!wr.sigsOk) witnessSigsOk = false;
      if (!wr.timingOk) witnessTimingOk = false;
      wr.distinct.forEach((k) => witnessKeys.add(k));
    }
    if (r.targetRound <= r.prevBeaconRound) futureOk = false;
    if (haveCorpus) {
      const t = derivePresentimentTarget(r.beaconValue, r.trialIndex, pools[0]!.length, pools[1]!.length);
      const chosen = pools[t.valence]![t.imageIndex];
      if (t.valence !== r.valence || chosen?.path !== r.imagePath || chosen?.sha256 !== r.imageSha256) derivedOk = false;
    }
    if (vocab.length && vocab.indexOf(r.choice) !== -1) {
      const expectedHit = vocab.indexOf(r.choice) === r.valence ? 1 : 0;
      if (expectedHit !== r.hit) hitsOk = false;
    }
  }

  // Re-hash the actual shown pixels (dedup by path) against the committed hash —
  // the chain runs beacon → committed image hash → real bytes.
  let pixelsOk = true;
  const seen = new Map<string, string>();
  for (const path of new Set(records.map((r) => r.imagePath))) {
    try {
      const res = await fetch(`/${path}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      seen.set(path, sha256(buf));
    } catch { pixelsOk = false; }
  }
  for (const r of records) if (seen.get(r.imagePath) !== r.imageSha256) pixelsOk = false;

  const n = records.length;
  checks.push({ label: `All ${n} choices were signed by the operator`, ok: sigsOk });
  checks.push({ label: 'Every image was fixed to a future beacon round', ok: futureOk, note: 'target round > the round known when the choice was made' });
  checks.push({ label: `All ${n} images re-derive from the public beacon`, ok: derivedOk, note: haveCorpus ? undefined : 'experiment definition unavailable — skipped' });
  checks.push({ label: 'Shown images match their committed SHA-256 (pixels)', ok: pixelsOk });
  checks.push({ label: 'Recorded hits match prediction vs revealed valence', ok: hitsOk });
  checks.push({ label: 'Trial records reproduce the sealed Merkle root', ok: merkle.root() === s.outputCommitment, note: s.outputCommitment });
  checks.push({ label: 'Raw blob matches its recorded SHA-256', ok: sha256(bytes) === s.rawSha256 });

  // Live witnesses (spec D16): the choice-timing residual is closed when an
  // independent witness co-signed each choice before its target round published.
  if (s.witnessed || witnessedTrials > 0) {
    const openRes = await verifyAttestations(s.witness?.open, s.openEntryHash, o.sessionId, 'open');
    const sealRes = await verifyAttestations(s.witness?.seal, s.outputCommitment, o.sessionId, 'seal');
    const keys = new Set<string>([...witnessKeys, ...openRes.distinct, ...sealRes.distinct]);
    const threshold = s.witness?.threshold ?? 1;
    checks.push({
      label: `All ${witnessedTrials} choices were co-signed by an independent witness`,
      ok: witnessSigsOk && witnessedTrials === records.length && witnessedTrials > 0,
    });
    checks.push({
      label: 'Each choice was witnessed while its target round was still in the future',
      ok: witnessTimingOk,
      note: 'witnessRound < targetRound — the choice provably preceded its target (closes backdating)',
    });
    checks.push({
      label: `At least ${threshold} independent witness(es) co-signed (quorum)`,
      ok: keys.size >= threshold,
      note: `${keys.size} distinct witness key(s)`,
    });
  }
}

async function verifySignature(pubKey: string, precommit: string, sig: string): Promise<boolean> {
  try {
    const pub = hexToBytes(pubKey.replace(/^ed25519:/, ''));
    const signature = hexToBytes(sig.replace(/^ed25519:/, ''));
    return await ed.verifyAsync(signature, new TextEncoder().encode(precommit), pub);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// In-browser session verification (spec §7.3) — the "don't trust us" feature.
//
// Given a session's revealed fields (its open + seal ledger entries plus the
// experiment definition), this recomputes the pre-commitment and anchor from
// first principles, checks the hash-chain entry hashes, and verifies the
// operator's Ed25519 signature — all in the browser, using the SAME pure
// @psymeter/core that the server and analysis/analyze.py use. Nothing here trusts
// the server's word for anything; every value is recomputed locally.
//
// (The raw-bit Merkle root is verified against the multi-megabyte raw blob in
// analysis/analyze.py; the in-browser checks cover everything except that blob.)

import { buildPrecommit, experimentHash, hashEntry } from '@psymeter/core';
import * as ed from '@noble/ed25519';
import type { OpenPayload, SealPayload, SessionDetail } from './api';

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
  }

  return checks;
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

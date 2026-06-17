import { createHash } from 'node:crypto';
import { bls12_381 } from '@noble/curves/bls12-381';
import type { BeaconRef } from '@psymeter/core';

/**
 * Public randomness beacon (spec §7, D2).
 *
 * A pulse fetched at session-creation time is bound into the pre-commitment, so
 * the session record provably did not exist before that pulse was published —
 * the server cannot pre-compute a library of runs and keep only flattering ones.
 */
export interface BeaconProvider {
  readonly id: string;
  fetchPulse(): Promise<BeaconRef>;
}

// drand quicknet (League of Entropy): unchained, 3 s period, short G1 signatures.
// The group public key below is the TRUST ANCHOR — every pulse is BLS-verified
// against it in-process (verifyQuicknetPulse), so the server never trusts the
// drand HTTP endpoint for authenticity (spec §7.6). An auditor can independently
// confirm this is the published quicknet key. (Switched from the older chained
// mainnet, recorded in the decision log: unchained verification is simpler and
// quicknet is the current League-of-Entropy default.)
const QUICKNET_CHAIN = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
const QUICKNET_PUBKEY =
  '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a';
const QUICKNET_URL = `https://api.drand.sh/${QUICKNET_CHAIN}/public/latest`;

/** Real drand quicknet pulse, BLS-verified before it is bound into a session. */
export class DrandBeacon implements BeaconProvider {
  readonly id = 'drand';

  async fetchPulse(): Promise<BeaconRef> {
    const res = await fetch(QUICKNET_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`drand fetch failed: HTTP ${res.status}`);
    const p = (await res.json()) as { round: number; randomness: string; signature: string };
    if (!verifyQuicknetPulse(p.round, p.signature)) {
      throw new Error(`drand pulse ${p.round} failed BLS verification — refusing to bind an unverified beacon`);
    }
    return { source: 'drand', chainHash: QUICKNET_CHAIN, round: p.round, value: p.randomness, signature: p.signature };
  }
}

/**
 * Verify a quicknet pulse's BLS signature against the group public key.
 *
 * quicknet is unchained: the signed message is SHA-256(round as 8-byte
 * big-endian) and the signature is a short signature on G1 (the public key is on
 * G2). Returns false on a malformed or non-verifying signature — a tampered
 * point makes noble throw, which we treat as invalid.
 */
export function verifyQuicknetPulse(round: number, signatureHex: string, publicKeyHex = QUICKNET_PUBKEY): boolean {
  try {
    const message = new Uint8Array(createHash('sha256').update(roundToBytesBE(round)).digest());
    return bls12_381.verifyShortSignature(hexToBytes(signatureHex), message, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

function roundToBytesBE(round: number): Uint8Array {
  const out = new Uint8Array(8);
  let x = BigInt(round);
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Offline placeholder beacon. NON-CONFIRMATORY: it provides no freshness
 * guarantee, so it must never back scientific data. Development/offline only.
 */
export class DevBeacon implements BeaconProvider {
  readonly id = 'dev';

  async fetchPulse(): Promise<BeaconRef> {
    return { source: 'dev', round: 0, value: '00' };
  }
}

/** Default to the real drand beacon; `PSYMETER_BEACON=dev` for offline work. */
export function selectBeacon(): BeaconProvider {
  return process.env.PSYMETER_BEACON === 'dev' ? new DevBeacon() : new DrandBeacon();
}

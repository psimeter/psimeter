import { createHash } from 'node:crypto';
import { bls12_381 } from '@noble/curves/bls12-381';

/**
 * The witness's OWN public-randomness beacon client (spec §7, D16).
 *
 * Independence is the whole point: a witness must fetch and verify the beacon
 * ITSELF, never trusting the experiment server's pulse. This is a deliberate,
 * small copy of the server's drand client (packages/server/src/beacon.ts) — the
 * quicknet group key + BLS verification are stable, published constants; sharing
 * a beacon *instance* with the server would defeat the purpose.
 *
 * Each attestation binds the round this client fetched and BLS-verified as its
 * time anchor: `witnessRound < targetRound` is what proves a precognition choice
 * was co-signed while its target was still in the future.
 */
export interface WitnessPulse {
  round: number;
  chainHash: string;
  randomness: string;
}

export interface WitnessBeacon {
  readonly id: string;
  /** Latest pulse, already verified — throws rather than return an unverified one. */
  latest(): Promise<WitnessPulse>;
}

const QUICKNET_CHAIN = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
const QUICKNET_PUBKEY =
  '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a';
const QUICKNET_LATEST = `https://api.drand.sh/${QUICKNET_CHAIN}/public/latest`;

/** Real drand quicknet, BLS-verified in-process before the witness will bind it. */
export class DrandWitnessBeacon implements WitnessBeacon {
  readonly id = 'drand';

  async latest(): Promise<WitnessPulse> {
    const res = await fetch(QUICKNET_LATEST, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`drand fetch failed: HTTP ${res.status}`);
    const p = (await res.json()) as { round: number; randomness: string; signature: string };
    if (!verifyQuicknetPulse(p.round, p.signature)) {
      throw new Error(`drand pulse ${p.round} failed BLS verification — witness refuses to bind it`);
    }
    return { round: p.round, chainHash: QUICKNET_CHAIN, randomness: p.randomness };
  }
}

/** quicknet is unchained: signed message = SHA-256(round as 8-byte BE), short sig on G1. */
export function verifyQuicknetPulse(round: number, signatureHex: string, publicKeyHex = QUICKNET_PUBKEY): boolean {
  try {
    const message = new Uint8Array(createHash('sha256').update(roundToBytesBE(round)).digest());
    return bls12_381.verifyShortSignature(hexToBytes(signatureHex), message, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

/**
 * Offline placeholder, identical numbering to the server's DevBeacon so the two
 * INDEPENDENT processes agree on the round clock: round = floor(now / period)
 * from a FIXED epoch 0 (NOT process start), period 200 ms under PSYMETER_FAST.
 * NON-CONFIRMATORY — for offline development/tests only.
 */
export class DevWitnessBeacon implements WitnessBeacon {
  readonly id = 'dev';
  private readonly periodMs = process.env.PSYMETER_FAST === '1' ? 200 : 1000;

  async latest(): Promise<WitnessPulse> {
    const round = Math.floor(Date.now() / this.periodMs);
    const randomness = createHash('sha256').update(`dev-beacon:${round}`).digest('hex');
    return { round, chainHash: 'dev', randomness };
  }
}

export function selectWitnessBeacon(): WitnessBeacon {
  return process.env.PSYMETER_BEACON === 'dev' ? new DevWitnessBeacon() : new DrandWitnessBeacon();
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

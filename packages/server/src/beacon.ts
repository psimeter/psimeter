import { createHash } from 'node:crypto';
import { bls12_381 } from '@noble/curves/bls12-381';
import type { BeaconRef } from '@psimeter/core';

/**
 * Public randomness beacon (spec §7, D2).
 *
 * A pulse fetched at session-creation time is bound into the pre-commitment, so
 * the session record provably did not exist before that pulse was published —
 * the server cannot pre-compute a library of runs and keep only flattering ones.
 */
export interface BeaconProvider {
  readonly id: string;
  /** The latest published pulse (freshness anchor for a session pre-commitment). */
  fetchPulse(): Promise<BeaconRef>;
  /** A specific round's pulse — throws if it has not been published yet. Used by
   * precognition to resolve a *future* round bound at choice time (spec §7.5). */
  fetchRound(round: number): Promise<BeaconRef>;
  /** Block until `round` is published (or a timeout), then return it. */
  waitForRound(round: number): Promise<BeaconRef>;
  /** Nominal seconds between rounds — lets a runner translate a round offset into
   * an approximate wait, and is non-confirmatory metadata only. */
  readonly periodSeconds: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  readonly periodSeconds = 3; // quicknet period

  async fetchPulse(): Promise<BeaconRef> {
    return this.toRef(await this.fetchJson(QUICKNET_URL));
  }

  async fetchRound(round: number): Promise<BeaconRef> {
    const url = `https://api.drand.sh/${QUICKNET_CHAIN}/public/${round}`;
    return this.toRef(await this.fetchJson(url));
  }

  /**
   * Poll until `round` is published. drand returns a non-2xx for a round that
   * does not exist yet, which we treat as "not published" and retry. The target
   * is bound BEFORE this resolves, so waiting cannot leak it (spec §7.5).
   */
  async waitForRound(round: number): Promise<BeaconRef> {
    const deadlineMs = Date.now() + (this.periodSeconds * 1000 * 4 + 30_000);
    for (;;) {
      try {
        return await this.fetchRound(round);
      } catch (e) {
        if (Date.now() > deadlineMs) throw new Error(`timeout waiting for drand round ${round}: ${String(e)}`);
        await sleep(1000);
      }
    }
  }

  private async fetchJson(url: string): Promise<{ round: number; randomness: string; signature: string }> {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`drand fetch failed: HTTP ${res.status}`);
    return (await res.json()) as { round: number; randomness: string; signature: string };
  }

  private toRef(p: { round: number; randomness: string; signature: string }): BeaconRef {
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
 * Offline placeholder beacon. NON-CONFIRMATORY: it provides no real freshness
 * guarantee, so it must never back scientific data. Development/offline only.
 *
 * It simulates an advancing round clock so the precognition flow (which binds a
 * *future* round and waits for it) is testable without network access: round =
 * floor(now / period), and each round's value is a deterministic hash of its
 * number (so /verify and analyze.py can reproduce derived targets).
 *
 * The epoch is FIXED at 0 (wall-clock), NOT process start, so an INDEPENDENT
 * witness process (packages/witness) computes the identical round number — its
 * `witnessRound < targetRound` check is meaningless if the two disagree (D16).
 */
export class DevBeacon implements BeaconProvider {
  readonly id = 'dev';
  readonly periodSeconds: number;
  private readonly periodMs: number;
  private readonly genesisMs = 0;

  constructor() {
    // Fast rounds under PSIMETER_FAST so a full precog session runs in seconds.
    this.periodMs = process.env.PSIMETER_FAST === '1' ? 200 : 1000;
    this.periodSeconds = this.periodMs / 1000;
  }

  private currentRound(): number {
    return Math.floor((Date.now() - this.genesisMs) / this.periodMs);
  }

  private ref(round: number): BeaconRef {
    const value = createHash('sha256').update(`dev-beacon:${round}`).digest('hex');
    return { source: 'dev', round, value };
  }

  async fetchPulse(): Promise<BeaconRef> {
    return this.ref(this.currentRound());
  }

  async fetchRound(round: number): Promise<BeaconRef> {
    if (round > this.currentRound()) throw new Error(`dev round ${round} not yet published`);
    return this.ref(round);
  }

  async waitForRound(round: number): Promise<BeaconRef> {
    const publishAtMs = this.genesisMs + round * this.periodMs;
    const waitMs = publishAtMs - Date.now();
    if (waitMs > 0) await sleep(waitMs + 5);
    return this.ref(round);
  }
}

/** Default to the real drand beacon; `PSIMETER_BEACON=dev` for offline work. */
export function selectBeacon(): BeaconProvider {
  return process.env.PSIMETER_BEACON === 'dev' ? new DevBeacon() : new DrandBeacon();
}

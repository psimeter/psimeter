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

// League of Entropy mainnet (chained, 30 s period). Public + verifiable.
const DRAND_CHAIN = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce';
const DRAND_URL = `https://api.drand.sh/${DRAND_CHAIN}/public/latest`;

/** Real drand pulse from the League of Entropy. */
export class DrandBeacon implements BeaconProvider {
  readonly id = 'drand';

  async fetchPulse(): Promise<BeaconRef> {
    const res = await fetch(DRAND_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`drand fetch failed: HTTP ${res.status}`);
    const p = (await res.json()) as { round: number; randomness: string; signature: string };
    return { source: 'drand', chainHash: DRAND_CHAIN, round: p.round, value: p.randomness, signature: p.signature };
  }
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

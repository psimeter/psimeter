/**
 * Shared domain types.
 *
 * This module is the current cross-language "source of truth" for the data
 * contracts described in docs/SPECIFICATION.md §8; JSON Schemas under `schema/`
 * will be generated from it later.
 */

/** Intention declared before a micro-PK run (spec D3 — tripolar protocol). */
export type Intention = 'HIGH' | 'LOW' | 'BASELINE';

/** Physical/logical class of an entropy source (spec D1). */
export type EntropyKind = 'os' | 'cpu-rdseed' | 'usb-trng' | 'qrng';

export interface EntropyMetadata {
  deviceId?: string;
  firmware?: string;
  driver?: string;
  /** Exact, frozen sampling parameters. Sources MUST be raw/unconditioned (D10). */
  sampling: Record<string, unknown>;
}

/**
 * A source of RAW, UNCONDITIONED random bits.
 * Implementations MUST NOT whiten or condition the output (spec D10).
 */
export interface EntropySource {
  readonly id: string;
  readonly kind: EntropyKind;
  /** false for non-publishable sources (e.g. the 'os' CSPRNG plumbing). */
  readonly confirmatory: boolean;
  readonly metadata: EntropyMetadata;
  /** Pull exactly `nBytes` of raw entropy; block until fulfilled or throw. */
  read(nBytes: number): Promise<Uint8Array>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

/** Reference to an external public randomness beacon pulse (spec §7). */
export interface BeaconRef {
  source: string;
  round: number;
  value: string;
}

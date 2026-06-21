import { randomBytes } from 'node:crypto';
import type { EntropySource, EntropyMetadata } from '@psimeter/core';

/**
 * OS CSPRNG entropy source.
 *
 * ⚠️ NON-CONFIRMATORY (spec D1): node:crypto is a CSPRNG seeded from hardware —
 * deterministic after seeding, so there is no live physical process to
 * influence. Use ONLY for CI / plumbing and pipeline tests, NEVER for
 * scientific data. `confirmatory` is hard-coded false so this can never be
 * mistaken for real data in a session record.
 */
export class OsEntropySource implements EntropySource {
  readonly id = 'os-csprng';
  readonly kind = 'os' as const;
  readonly confirmatory = false;
  readonly metadata: EntropyMetadata = {
    driver: 'node:crypto.randomBytes',
    sampling: { conditioning: 'csprng' },
  };

  async read(nBytes: number): Promise<Uint8Array> {
    return new Uint8Array(randomBytes(nBytes));
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: 'non-confirmatory CSPRNG' };
  }
}

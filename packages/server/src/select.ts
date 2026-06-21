import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EntropySource } from '@psimeter/core';
import { OsEntropySource } from './entropy/os.js';
import { SidecarEntropySource } from './entropy/sidecar.js';

const here = dirname(fileURLToPath(import.meta.url));

function sidecarBinPath(): string {
  const exe = process.platform === 'win32' ? 'entropy-provider.exe' : 'entropy-provider';
  return resolve(here, '../../entropy-provider/target/release', exe);
}

/**
 * Choose the entropy source for this server process.
 *
 * Default: prefer the RDSEED sidecar when it is built and reports `available`,
 * so the owner self-tests on real physical entropy (pilot-grade, D1). Falls back
 * to the NON-CONFIRMATORY OS source. Override with `PSIMETER_ENTROPY=os|rdseed`.
 */
export function selectEntropySource(): EntropySource {
  const pref = process.env.PSIMETER_ENTROPY;
  if (pref === 'os') return new OsEntropySource();

  const bin = sidecarBinPath();
  if (existsSync(bin)) {
    try {
      const info = JSON.parse(execFileSync(bin, ['--info']).toString()) as { available?: boolean };
      if (info.available) return new SidecarEntropySource(bin);
    } catch {
      /* fall through to OS */
    }
  }

  if (pref === 'rdseed') {
    throw new Error('PSIMETER_ENTROPY=rdseed but the entropy-provider sidecar is unavailable; build it with cargo.');
  }
  return new OsEntropySource();
}

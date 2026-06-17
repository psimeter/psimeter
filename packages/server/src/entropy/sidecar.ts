import { spawn } from 'node:child_process';
import type { EntropySource, EntropyMetadata, EntropyKind } from '@psymeter/core';

/**
 * Entropy source backed by the Rust `entropy-provider` sidecar (e.g. RDSEED).
 * Real physical entropy, pilot-grade (spec D1). Bytes are RAW/unconditioned (D10).
 *
 * One process is spawned per `read`; the generation loop pulls in modest blocks,
 * so this is simple and robust. A long-lived streaming variant can replace it
 * later without changing the EntropySource contract.
 */
export class SidecarEntropySource implements EntropySource {
  readonly kind: EntropyKind = 'cpu-rdseed';
  readonly confirmatory = false; // RDSEED is pilot-grade, not publication-grade (D1)

  constructor(
    private readonly binPath: string,
    readonly id = 'rdseed',
    readonly metadata: EntropyMetadata = {
      driver: 'entropy-provider/rdseed',
      sampling: { conditioning: 'none', instruction: 'RDSEED' },
    },
    private readonly source = 'rdseed',
  ) {}

  read(nBytes: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binPath, ['--source', this.source, '--bytes', String(nBytes)]);
      const chunks: Buffer[] = [];
      proc.stdout.on('data', (c: Buffer) => chunks.push(c));
      proc.stderr.on('data', (c: Buffer) => process.stderr.write(c));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`entropy-provider exited with code ${code}`));
        const out = Buffer.concat(chunks);
        if (out.length !== nBytes) {
          return reject(new Error(`expected ${nBytes} bytes from sidecar, got ${out.length}`));
        }
        resolve(new Uint8Array(out));
      });
    });
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: 'spawns entropy-provider per read' };
  }
}

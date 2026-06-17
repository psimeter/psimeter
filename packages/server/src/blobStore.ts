import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Persist a raw byte stream, content-addressed by its SHA-256 (spec §7.2, D2).
 *
 * For a true physical (non-reproducible) source, the stored raw stream IS the
 * scientific record — so it must be retained and independently re-verifiable
 * against both the flat hash and the session's streaming Merkle commitment.
 */
export function writeBlob(dir: string, bytes: Uint8Array): { ref: string; sha256: string } {
  const hex = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(dir, { recursive: true });
  const name = `sha256-${hex}.bin`;
  writeFileSync(resolve(dir, name), bytes);
  return { ref: `blobs/${name}`, sha256: `sha256:${hex}` };
}

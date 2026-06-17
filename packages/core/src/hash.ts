import { createHash } from 'node:crypto';

/**
 * Hashing helpers. We always carry the algorithm as a prefix ("sha256:…") so
 * that stored hashes are self-describing and future algorithm migrations are
 * unambiguous.
 */

/** Lowercase-hex SHA-256, prefixed "sha256:". Accepts bytes or a UTF-8 string. */
export function sha256(data: Uint8Array | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

/** Raw 32-byte SHA-256 digest (no prefix). */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

/** Strip the "sha256:" prefix and return the hex digest. Throws on mismatch. */
export function hexOf(prefixed: string): string {
  const idx = prefixed.indexOf(':');
  const algo = prefixed.slice(0, idx);
  const hex = prefixed.slice(idx + 1);
  if (algo !== 'sha256' || hex.length !== 64) {
    throw new Error(`not a sha256 hash: ${prefixed}`);
  }
  return hex;
}

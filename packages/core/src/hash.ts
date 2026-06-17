import { sha256 as nobleSha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Hashing helpers. We always carry the algorithm as a prefix ("sha256:…") so
 * that stored hashes are self-describing and future algorithm migrations are
 * unambiguous.
 *
 * SHA-256 comes from @noble/hashes — a pure-JS, dependency-free implementation
 * that runs identically in Node and the browser (so the client can recompute
 * commitments and anchors in-page) and produces byte-identical digests to any
 * standard SHA-256, preserving cross-language parity with analysis/analyze.py.
 */

/** Lowercase-hex SHA-256, prefixed "sha256:". Accepts bytes or a UTF-8 string. */
export function sha256(data: Uint8Array | string): string {
  // noble's sha256 encodes strings as UTF-8 internally — byte-identical to the
  // previous Buffer.from(data, 'utf8') path, so committed hashes are unchanged.
  return 'sha256:' + bytesToHex(nobleSha256(data));
}

/** Raw 32-byte SHA-256 digest (no prefix). */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
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

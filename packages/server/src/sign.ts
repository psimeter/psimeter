import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

/**
 * Verify an Ed25519 signature over a message string (spec D6, §7.2).
 *
 * The operator's pseudonymous identity is a raw 32-byte Ed25519 public key,
 * carried as `ed25519:<hex>`; the signature is `ed25519:<hex>` over the UTF-8
 * bytes of the pre-commitment string. This binds each session to its operator
 * and makes the declared intention non-repudiable.
 *
 * Returns false on any malformed input rather than throwing.
 */
export function verifyEd25519(pubKeyPrefixed: string, message: string, sigPrefixed: string): boolean {
  try {
    const pub = Buffer.from(stripPrefix(pubKeyPrefixed), 'hex');
    const sig = Buffer.from(stripPrefix(sigPrefixed), 'hex');
    if (pub.length !== 32 || sig.length !== 64) return false;

    // Import the raw public key via JWK (OKP / Ed25519, x = base64url(pubkey)).
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: pub.toString('base64url') },
      format: 'jwk',
    });
    return cryptoVerify(null, Buffer.from(message, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

function stripPrefix(value: string): string {
  const idx = value.indexOf(':');
  if (idx < 0 || value.slice(0, idx) !== 'ed25519') throw new Error(`not an ed25519 value: ${value}`);
  return value.slice(idx + 1);
}

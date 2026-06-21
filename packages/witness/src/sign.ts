import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  type KeyObject,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * The witness's Ed25519 identity (spec D6/D16). A witness's co-signature is what
 * an auditor checks; the key is this node's pseudonymous identity. It is
 * persisted (PKCS8 PEM) under the git-ignored ledger dir and reused across
 * restarts, so a long-lived witness keeps the same public key (auditors pin it).
 */
export interface WitnessIdentity {
  /** Public key as `ed25519:<hex>` (the 32 raw bytes). */
  pubKey: string;
  /** Sign a UTF-8 message → `ed25519:<hex>`. */
  sign(message: string): string;
}

export function loadOrCreateIdentity(keyPath: string): WitnessIdentity {
  let privateKey: KeyObject;
  if (existsSync(keyPath)) {
    privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));
  } else {
    const pair = generateKeyPairSync('ed25519');
    privateKey = pair.privateKey;
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), { mode: 0o600 });
  }
  const jwk = createPublicKey(privateKey).export({ format: 'jwk' }) as { x: string };
  const pubHex = Buffer.from(jwk.x, 'base64url').toString('hex');
  return {
    pubKey: `ed25519:${pubHex}`,
    sign: (message: string) => `ed25519:${edSign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex')}`,
  };
}

// Operator identity (spec D6): a persistent, pseudonymous Ed25519 keypair held
// ONLY in this browser's localStorage — no PII, no server-side account. It lets
// a visitor accumulate sessions and "return", and it signs each pre-commitment
// for non-repudiation. @noble/ed25519 is bundled (not from a CDN); its async API
// uses the platform WebCrypto SHA-512, so no extra wiring is needed.

import * as ed from '@noble/ed25519';

const KEY_STORAGE = 'psymeter.operatorKey';
let cachedPub: string | null = null;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function privateKey(): Uint8Array {
  let hex = localStorage.getItem(KEY_STORAGE);
  if (!hex || hex.length !== 64) {
    hex = toHex(ed.utils.randomPrivateKey());
    localStorage.setItem(KEY_STORAGE, hex);
  }
  return fromHex(hex);
}

/** This browser's operator public key, as `ed25519:<hex>`. */
export async function getOperatorPubKey(): Promise<string> {
  if (cachedPub) return cachedPub;
  const pub = await ed.getPublicKeyAsync(privateKey());
  cachedPub = `ed25519:${toHex(pub)}`;
  return cachedPub;
}

/** Sign the server's pre-commitment with the operator private key (spec §7.2). */
export async function signPrecommit(precommit: string): Promise<string> {
  return signMessage(precommit);
}

/** Sign an arbitrary UTF-8 message with the operator private key. Used for the
 *  psi-candidate contact challenge (D15): the signature proves this browser holds
 *  the key whose public score earned eligibility. */
export async function signMessage(message: string): Promise<string> {
  const sig = await ed.signAsync(new TextEncoder().encode(message), privateKey());
  return `ed25519:${toHex(sig)}`;
}

/** Short, human-friendly prefix of a public key for display (not security). */
export function shortId(pubKey: string): string {
  return pubKey.replace(/^ed25519:/, '').slice(0, 8);
}

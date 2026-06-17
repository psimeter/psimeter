import { sha256Bytes } from './hash.js';

/**
 * Streaming binary Merkle tree over fixed leaves, with domain separation so a
 * leaf hash can never be confused with an internal-node hash (second-preimage
 * resistance):
 *
 *   leaf(d)    = SHA256(0x00 ‖ d)
 *   node(l, r) = SHA256(0x01 ‖ l ‖ r)
 *
 * Used to commit to a session's raw entropy stream as it is produced
 * (spec §7.2) and to emit periodic checkpoint roots. An odd node at any level
 * is promoted unchanged; Bitcoin-style last-node duplication is intentionally
 * NOT used (it admits a known duplicate-leaf ambiguity).
 */
const LEAF = 0x00;
const NODE = 0x01;

export class MerkleAccumulator {
  private readonly leaves: Uint8Array[] = [];

  /** Add one leaf — e.g. one checkpoint block of raw entropy bytes. */
  add(data: Uint8Array): void {
    this.leaves.push(sha256Bytes(concat(Uint8Array.of(LEAF), data)));
  }

  get leafCount(): number {
    return this.leaves.length;
  }

  /** Current Merkle root as "sha256:…". Throws if no leaves have been added. */
  root(): string {
    if (this.leaves.length === 0) throw new Error('merkle: no leaves');
    let level: Uint8Array[] = this.leaves;
    while (level.length > 1) {
      const next: Uint8Array[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i]!;
        const right = level[i + 1];
        next.push(
          right ? sha256Bytes(concat(Uint8Array.of(NODE), left, right)) : left,
        );
      }
      level = next;
    }
    return 'sha256:' + toHex(level[0]!);
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

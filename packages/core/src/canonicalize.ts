/**
 * Deterministic JSON canonicalization for hashing & signing.
 *
 * We commit to a RESTRICTED JSON profile so the byte representation is
 * unambiguous across languages (TypeScript, Rust, Python) — a prerequisite for
 * the cross-language verification in docs/SPECIFICATION.md §7/§8. The Python
 * analysis pipeline reproduces this exact form with
 * `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
 *
 * Rules (a pragmatic subset of RFC 8785 / JCS):
 *  - Object keys sorted by UTF-16 code unit (matches ECMAScript string order).
 *  - Only finite SAFE INTEGERS are permitted as numbers. Floats are REJECTED:
 *    their shortest round-trip form is a portability hazard. Every committed
 *    quantity in PsyMeter is an integer or string; derived statistics (z-scores)
 *    are display-only and never appear in a committed payload (spec §8.1, §8.5).
 *  - undefined / NaN / Infinity / bigint / functions are rejected.
 */
export function canonicalize(value: unknown): string {
  return encode(value);
}

function encode(v: unknown): string {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'boolean':
      return v ? 'true' : 'false';
    case 'string':
      return JSON.stringify(v); // RFC 8785-compatible string escaping
    case 'number':
      if (!Number.isInteger(v) || !Number.isSafeInteger(v)) {
        throw new Error(`canonicalize: only safe integers are allowed, got ${v}`);
      }
      return String(v);
    case 'object': {
      if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']';
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return '{' + keys.map((k) => JSON.stringify(k) + ':' + encode(obj[k])).join(',') + '}';
    }
    default:
      throw new Error(`canonicalize: unsupported type ${typeof v}`);
  }
}

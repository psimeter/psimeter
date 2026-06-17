import { createHash } from 'node:crypto';

/**
 * Minimal OpenTimestamps client for automated external anchoring (spec §7.6, D2).
 *
 * It submits a 32-byte digest to public OTS aggregator calendars and assembles a
 * standard detached `.ots` proof, which anyone can later complete and check with
 * the ordinary OpenTimestamps tools (`ots upgrade` / `ots verify`) — pinning the
 * ledger head into Bitcoin's timestamp, with no account and no cost.
 *
 * This is operational tooling, NOT part of the auditor's trust path: the proof it
 * writes is verified by standard OTS software, not by any PsyMeter code. So a
 * tiny, dependency-free client is appropriate. Detached-proof layout (mirrors
 * python-opentimestamps): MAGIC ‖ version ‖ sha256-op ‖ <32-byte msg> ‖ <calendar
 * timestamp>, where the calendar's /digest response IS the serialized timestamp.
 */

// b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
const HEADER_MAGIC = Uint8Array.from([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00,
  0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);
const VERSION = 0x01;
const OP_SHA256 = 0x08;

// Public OpenTimestamps aggregator calendars. We keep the proof from the first
// that answers (a valid single-calendar proof); merging several would add
// redundancy but needs a full timestamp-tree merge — a later nicety.
const CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

export function sha256Bytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

/** Submit a 32-byte digest to a calendar; return the serialized timestamp proof. */
export async function stampHashViaOpenTimestamps(digest: Uint8Array): Promise<Uint8Array> {
  if (digest.length !== 32) throw new Error('expected a 32-byte sha256 digest');
  const errors: string[] = [];
  for (const calendar of CALENDARS) {
    try {
      const res = await fetch(`${calendar}/digest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Accept: 'application/octet-stream',
          'User-Agent': 'psymeter-anchor',
        },
        body: digest,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      errors.push(`${calendar}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`all OpenTimestamps calendars failed (${errors.join('; ')})`);
}

/** Assemble a standard detached `.ots` proof from a message digest + calendar timestamp. */
export function buildOtsProof(messageDigest: Uint8Array, calendarTimestamp: Uint8Array): Uint8Array {
  if (messageDigest.length !== 32) throw new Error('expected a 32-byte message digest');
  const out = new Uint8Array(HEADER_MAGIC.length + 2 + messageDigest.length + calendarTimestamp.length);
  let off = 0;
  out.set(HEADER_MAGIC, off);
  off += HEADER_MAGIC.length;
  out[off++] = VERSION;
  out[off++] = OP_SHA256;
  out.set(messageDigest, off);
  off += messageDigest.length;
  out.set(calendarTimestamp, off);
  return out;
}

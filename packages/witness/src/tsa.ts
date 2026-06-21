/**
 * Minimal RFC 3161 Time-Stamping client (spec D16, Q2).
 *
 * The witness periodically stamps its feed HEAD with an independent TSA, so the
 * "this feed prefix existed at time T" anchor comes from a third party the
 * experimenter cannot forge — this is what makes even a single owner-run witness
 * un-backdatable (the TSA, not the witness's own clock, fixes the time).
 *
 * Like our OpenTimestamps client, this is operational tooling, NOT part of the
 * auditor's in-code trust path: we build a standard TimeStampReq, POST it, and
 * store the raw TimeStampResp as a `.tsr`. Full cryptographic validation is one
 * standard command — `openssl ts -verify` — while the in-code verifiers only walk
 * the token's TSTInfo to read genTime + confirm the messageImprint is our head.
 *
 * Default TSA is freeTSA.org (RFC 3161 over HTTP, no account, no cost);
 * override with PSIMETER_TSA_URL.
 */

// AlgorithmIdentifier for SHA-256: SEQUENCE { OID 2.16.840.1.101.3.4.2.1, NULL }.
const SHA256_ALG_ID = [
  0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,
];

/**
 * DER-encode a TimeStampReq over a 32-byte SHA-256 digest:
 *   SEQUENCE { version INTEGER 1, messageImprint { sha256AlgId, OCTET STRING digest }, certReq TRUE }
 */
export function buildTimeStampReq(digest: Uint8Array): Uint8Array {
  if (digest.length !== 32) throw new Error('expected a 32-byte sha256 digest');
  const imprintContent = [...SHA256_ALG_ID, 0x04, 0x20, ...digest]; // algId + OCTET STRING(32)
  const messageImprint = [0x30, imprintContent.length, ...imprintContent];
  const content = [0x02, 0x01, 0x01, ...messageImprint, 0x01, 0x01, 0xff]; // version, imprint, certReq=TRUE
  return Uint8Array.from([0x30, content.length, ...content]);
}

/** Submit a head digest to the TSA; resolve to the raw `.tsr` (TimeStampResp) bytes. */
export async function requestTimestamp(tsaUrl: string, digest: Uint8Array): Promise<Uint8Array> {
  const res = await fetch(tsaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
      Accept: 'application/timestamp-reply',
      'User-Agent': 'psimeter-witness',
    },
    body: buildTimeStampReq(digest),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`TSA HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

import type { WitnessAttestation, WitnessSubjectKind } from '@psimeter/core';

/**
 * Client to the independent live witness(es) (spec §7.4, D16).
 *
 * The server asks each configured witness to co-sign a subject in real time; the
 * witness independently fetches+verifies its own beacon round and (for a
 * precognition `choice`) refuses if the target round is already public. The
 * server NEVER asserts who witnessed — it just relays attestations; the auditor
 * counts an M-of-N quorum of *trusted* keys (a published list) in analyze.py and
 * /verify.
 *
 * Configure with `PSIMETER_WITNESS=url1[,url2,...]` and optional
 * `PSIMETER_WITNESS_THRESHOLD=M`. Unset → witnessing is OFF and sessions are
 * sealed exactly as before (`witnessed:false`), so existing flows are unchanged.
 */
export interface AttestSubject {
  subjectHash: string;
  sessionId: string;
  trialIndex?: number;
  kind: WitnessSubjectKind;
  /** For a precognition `choice`: the future round the choice targets. */
  claimedTargetRound?: number;
}

export class WitnessClient {
  constructor(
    readonly urls: string[],
    readonly threshold: number,
  ) {}

  get enabled(): boolean {
    return this.urls.length > 0 && this.threshold > 0;
  }

  /** Collect attestations from all configured witnesses in parallel (best-effort). */
  async attest(subject: AttestSubject): Promise<WitnessAttestation[]> {
    if (!this.enabled) return [];
    const settled = await Promise.allSettled(this.urls.map((u) => this.attestOne(u, subject)));
    const ok: WitnessAttestation[] = [];
    for (const r of settled) if (r.status === 'fulfilled' && r.value) ok.push(r.value);
    return ok;
  }

  /** Attest and enforce the M-of-N threshold; throws if too few distinct witnesses respond. */
  async attestQuorum(subject: AttestSubject): Promise<WitnessAttestation[]> {
    const got = await this.attest(subject);
    const distinct = new Set(got.map((a) => a.witnessPubKey)).size;
    if (distinct < this.threshold) {
      throw new Error(`witness quorum not met for "${subject.kind}" (${distinct}/${this.threshold} witnesses)`);
    }
    return got;
  }

  /** Configured witnesses' identities, for GET /api/witness (so /verify knows what to check). */
  async info(): Promise<{ pubKey: string; beacon: string }[]> {
    const out: { pubKey: string; beacon: string }[] = [];
    for (const u of this.urls) {
      try {
        const res = await fetch(`${trimSlash(u)}/witness/info`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const j = (await res.json()) as { witnessPubKey: string; beacon: string };
          out.push({ pubKey: j.witnessPubKey, beacon: j.beacon });
        }
      } catch {
        /* a witness being offline is not fatal to serving info */
      }
    }
    return out;
  }

  private async attestOne(url: string, subject: AttestSubject): Promise<WitnessAttestation | null> {
    const res = await fetch(`${trimSlash(url)}/witness/attest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subject),
      signal: AbortSignal.timeout(8000),
    });
    // A non-2xx (incl. 409 "target already public" refusal) is excluded from quorum.
    if (!res.ok) return null;
    return (await res.json()) as WitnessAttestation;
  }
}

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

/** Build the witness client from the environment (off when unset). */
export function selectWitnessClient(): WitnessClient {
  const urls = (process.env.PSIMETER_WITNESS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const requested = Number(process.env.PSIMETER_WITNESS_THRESHOLD ?? urls.length);
  // Default threshold = number of configured witnesses; clamp to [1, urls.length].
  const threshold = urls.length ? Math.min(Math.max(1, requested), urls.length) : 0;
  return new WitnessClient(urls, threshold);
}

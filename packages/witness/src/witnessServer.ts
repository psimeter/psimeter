import http from 'node:http';
import { readFileSync } from 'node:fs';
import { witnessStatement, type WitnessSubjectKind } from '@psimeter/core';
import type { WitnessBeacon } from './beacon.js';
import type { WitnessIdentity } from './sign.js';
import type { WitnessFeed } from './witnessFeed.js';

/**
 * The witness HTTP service (spec D16). It does the one job that must be
 * independent of the experiment server:
 *   1. fetch + verify the latest beacon round ITSELF (never trusting the caller),
 *   2. for a precognition `choice`, refuse if the target round is already public
 *      (`witnessRound >= claimedTargetRound`) — that would be backdating,
 *   3. Ed25519-sign the canonical witnessStatement and append it to its own feed,
 *   4. return the attestation for the server to inline + publish the feed for mirrors.
 */
export interface AttestRequest {
  subjectHash: string;
  sessionId: string;
  trialIndex?: number;
  kind: WitnessSubjectKind;
  /** Present for precognition `choice`: the future round the choice targets. */
  claimedTargetRound?: number;
}

export function createWitnessServer(opts: {
  beacon: WitnessBeacon;
  identity: WitnessIdentity;
  feed: WitnessFeed;
  tsaUrl: string;
}): http.Server {
  const { beacon, identity, feed, tsaUrl } = opts;

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/witness/attest') {
      void handleAttest(req, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/witness/feed') {
      try {
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
        res.end(readFileSync(feed.feedPath));
      } catch {
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' }).end('');
      }
      return;
    }
    if (req.method === 'GET' && url.pathname === '/witness/info') {
      sendJson(res, 200, {
        witnessPubKey: identity.pubKey,
        beacon: beacon.id,
        tsaUrl,
        feedHead: feed.currentHead ? feed.currentHead.entryHash : null,
        feedLength: feed.currentHead ? feed.currentHead.seq + 1 : 0,
      });
      return;
    }
    res.writeHead(404).end('not found');
  });

  async function handleAttest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = JSON.parse(await readBody(req)) as AttestRequest;
      if (!body.subjectHash || !body.sessionId || !body.kind) {
        sendJson(res, 400, { error: 'subjectHash, sessionId and kind are required' });
        return;
      }
      // Independent time anchor: WE fetch + verify the latest round, not the caller.
      const pulse = await beacon.latest();

      // Anti-backdating: for a precognition choice, the target must still be FUTURE
      // from our own freshly-verified round, or we refuse to co-sign.
      if (typeof body.claimedTargetRound === 'number' && pulse.round >= body.claimedTargetRound) {
        sendJson(res, 409, {
          error: `refused: witnessRound ${pulse.round} >= targetRound ${body.claimedTargetRound} (target already public)`,
        });
        return;
      }

      const statement = witnessStatement({
        subjectHash: body.subjectHash,
        sessionId: body.sessionId,
        trialIndex: body.trialIndex,
        kind: body.kind,
        witnessRound: pulse.round,
        witnessChainHash: pulse.chainHash,
        witnessPubKey: identity.pubKey,
      });
      const witnessSig = identity.sign(statement);

      // Publish to the witness's own append-only feed (the independent record).
      const { feedSeq, feedEntryHash } = feed.attest({
        subjectHash: body.subjectHash,
        sessionId: body.sessionId,
        ...(typeof body.trialIndex === 'number' ? { trialIndex: body.trialIndex } : {}),
        kind: body.kind,
        witnessRound: pulse.round,
        witnessChainHash: pulse.chainHash,
        witnessPubKey: identity.pubKey,
        witnessSig,
      });

      sendJson(res, 200, {
        witnessPubKey: identity.pubKey,
        witnessRound: pulse.round,
        witnessChainHash: pulse.chainHash,
        witnessSig,
        feedSeq,
        feedEntryHash,
      });
    } catch (err) {
      sendJson(res, 400, { error: String(err) });
    }
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, obj: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

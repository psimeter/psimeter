/**
 * PsiMeter witness node entry point (spec §7.4, D16).
 *
 * An INDEPENDENT live witness: co-signs the experiment server's checkpoints
 * (micro-PK) and forced-choice commits (precognition) in real time, binding a
 * fresh drand round it verifies itself, on its own append-only feed that it
 * TSA-stamps. Run one per host/operator; the verifiers count an M-of-N quorum of
 * trusted witness keys, so federated peers strengthen the guarantee with no code
 * change.
 *
 *   PSIMETER_BEACON=dev PSIMETER_FAST=1 npm run witness    # offline pilot
 *   npm run witness                                         # real drand + TSA
 */
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectWitnessBeacon } from './beacon.js';
import { loadOrCreateIdentity } from './sign.js';
import { WitnessFeed } from './witnessFeed.js';
import { createWitnessServer } from './witnessServer.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function repoPath(envValue: string | undefined, fallback: string): string {
  const v = envValue ?? fallback;
  return isAbsolute(v) ? v : resolve(repoRoot, v);
}

const port = Number(process.env.PSIMETER_WITNESS_PORT ?? 8788);
const feedPath = repoPath(process.env.PSIMETER_WITNESS_FEED, 'ledger/witness-feed.jsonl');
const keyPath = repoPath(process.env.PSIMETER_WITNESS_KEY, 'ledger/witness-key.pem');
const tsaUrl = process.env.PSIMETER_TSA_URL ?? 'https://freetsa.org/tsr';
const tsaIntervalMs = Number(process.env.PSIMETER_WITNESS_TSA_INTERVAL_MS ?? 60_000);

const beacon = selectWitnessBeacon();
const identity = loadOrCreateIdentity(keyPath);
const feed = new WitnessFeed(feedPath);
const server = createWitnessServer({ beacon, identity, feed, tsaUrl });

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PsiMeter witness listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`[witness] pubkey ${identity.pubKey}`);
  // eslint-disable-next-line no-console
  console.log(
    `[witness] beacon "${beacon.id}"` + (beacon.id === 'dev' ? '  - NON-CONFIRMATORY placeholder (offline)' : '') +
      `  feed ${feedPath}`,
  );
});

// Periodically stamp the feed head with the independent TSA (best-effort).
if (tsaIntervalMs > 0) {
  const timer = setInterval(() => void feed.stampHead(tsaUrl), tsaIntervalMs);
  timer.unref?.();
}

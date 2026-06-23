/**
 * Parity check for the materialized ReadModel (spec D18).
 *
 * Folds a synthetic ledger through the incremental ReadModel and asserts it
 * reproduces the batch ledgerReader reference (globalStats / leaderboard /
 * psiForOperator) exactly — the guarantee that the O(1) view never drifts from
 * the straightforward whole-ledger computation.
 *
 *   npx tsx src/readModelSmoke.ts
 */
import type { LedgerEntry } from '@psimeter/core';
import { PSI_CANDIDATE_MIN_SESSIONS } from '@psimeter/core';
import { ReadModel } from './readModel.js';
import { globalStats, leaderboard, psiForOperator, toSummary, type SessionSummary, type OpenPayload } from './ledgerReader.js';

// --- deterministic PRNG so the check is reproducible ---
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260623);
const CHOICES = ['HIGH', 'LOW', 'BASELINE'] as const;
const N_BITS = 180000;

// --- build a synthetic ledger: many operators, varied session counts + z ---
const entries: LedgerEntry[] = [];
let ts = 0;
const nextTs = () => new Date(1_780_000_000_000 + (ts += 1000)).toISOString();
const mk = (type: LedgerEntry['type'], payload: unknown): LedgerEntry =>
  ({ seq: entries.length, ts: nextTs(), prevHash: 'x', type, payload, entryHash: 'h' + entries.length });

entries.push(mk('genesis', { note: 'parity' }));
let sid = 0;
const operators = 45;
for (let op = 0; op < operators; op++) {
  const operatorPubKey = `ed25519:op${op}`;
  const nSessions = Math.floor(rnd() * 13); // 0..12, so some are ineligible (<5)
  for (let s = 0; s < nSessions; s++) {
    const sessionId = `s${sid++}`;
    const choice = CHOICES[Math.floor(rnd() * CHOICES.length)]!;
    // ones drawn around the fair-coin mean with a spread, to make varied z's
    const noise = (rnd() - 0.5) * 6 * Math.sqrt(N_BITS * 0.25);
    const ones = Math.max(0, Math.min(N_BITS, Math.round(N_BITS / 2 + noise)));
    entries.push(mk('session.open', {
      sessionId, experimentId: 'binary-micropk', experimentVersion: 1, intention: choice,
      operatorPubKey, operatorSig: 'sig', beacon: { source: 'drand', round: 100 + sid, value: 'v' },
      entropySource: { id: 'rdseed', kind: 'cpu-rdseed', confirmatory: false, metadata: {} },
      serverNonce: 'n', precommit: 'p', anchor: `A${sid}`,
    } satisfies OpenPayload));
    // leave a few sessions unsealed to exercise the open-without-seal path
    if (rnd() < 0.9) {
      entries.push(mk('session.seal', {
        sessionId, openEntryHash: 'oh', outputCommitment: 'oc', rawBlobRef: 'rb',
        ones, nSamples: N_BITS,
      }));
    }
  }
}

// --- fold through the incremental view ---
const view = new ReadModel();
for (const e of entries) view.ingest(e);

// --- batch reference: join opens+seals into summaries, then the batch funcs ---
const bySession = new Map<string, { open: LedgerEntry; seal: LedgerEntry | null }>();
const order: string[] = [];
for (const e of entries) {
  if (e.type === 'session.open') { bySession.set((e.payload as OpenPayload).sessionId, { open: e, seal: null }); order.push((e.payload as OpenPayload).sessionId); }
  else if (e.type === 'session.seal') { const j = bySession.get((e.payload as { sessionId: string }).sessionId); if (j) j.seal = e; }
}
const rows: SessionSummary[] = order.map((id) => toSummary(bySession.get(id)!));

// --- assertions ---
let failures = 0;
const fail = (msg: string) => { console.error('  ✗ ' + msg); failures++; };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// stats parity (extremes compared by membership to tolerate float-tie reordering)
const vs = view.stats();
const bs = globalStats(rows);
for (const k of ['sessions', 'sealed', 'totalBits', 'byChoice', 'anomalies', 'highMinusLow'] as const) {
  if (!eq(vs[k], bs[k])) fail(`stats.${k}: view=${JSON.stringify(vs[k])} batch=${JSON.stringify(bs[k])}`);
}
const vE = new Set(vs.extremes.map((e) => e.sessionId));
const bE = new Set(bs.extremes.map((e) => e.sessionId));
if (vs.extremes.length !== bs.extremes.length || [...bE].some((id) => !vE.has(id))) fail('stats.extremes membership differs');

// per-operator psi parity
for (let op = 0; op < operators; op++) {
  const key = `ed25519:op${op}`;
  if (!eq(view.psiFor(key), psiForOperator(rows, key))) fail(`psiFor(${key}) differs`);
}

// leaderboard parity: top-25 eligible, same order; meta counts
const vl = view.leaderboard();
const expected = leaderboard(rows).operators.filter((o) => o.psi.scoredSessions >= PSI_CANDIDATE_MIN_SESSIONS).slice(0, 25);
if (!eq(vl.operators.map((o) => o.operatorPubKey), expected.map((o) => o.operatorPubKey))) {
  fail(`leaderboard order differs:\n   view=${vl.operators.map((o) => o.operatorPubKey).join(',')}\n   want=${expected.map((o) => o.operatorPubKey).join(',')}`);
}
if (!eq(vl.operators.map((o) => o.psi.points), expected.map((o) => o.psi.points))) fail('leaderboard psi.points differ');
const refMeta = leaderboard(rows).meta;
if (vl.meta.totalOperators !== refMeta.totalOperators) fail(`meta.totalOperators ${vl.meta.totalOperators} != ${refMeta.totalOperators}`);
if (vl.meta.eligibleOperators !== refMeta.eligibleOperators) fail(`meta.eligibleOperators ${vl.meta.eligibleOperators} != ${refMeta.eligibleOperators}`);
if (vl.meta.candidates !== refMeta.candidates) fail(`meta.candidates ${vl.meta.candidates} != ${refMeta.candidates}`);

// self-pin parity: ranking matches psiFor, rank is consistent for an eligible op
const someEligible = expected[Math.min(2, expected.length - 1)]?.operatorPubKey;
if (someEligible) {
  const withSelf = view.leaderboard(someEligible);
  if (!withSelf.self) fail('self missing for eligible operator');
  else {
    if (!eq(withSelf.self.ranking.psi, view.psiFor(someEligible))) fail('self.ranking.psi != psiFor');
    const expectRank = expected.findIndex((o) => o.operatorPubKey === someEligible) + 1;
    if (withSelf.self.rank !== expectRank) fail(`self.rank ${withSelf.self.rank} != ${expectRank} (top-25 case)`);
  }
}

console.log(`readModel parity: ${entries.length} entries, ${rows.length} sessions, ${operators} operators`);
console.log(`  stats: ${vs.sessions} sessions / ${vs.sealed} sealed; leaderboard: ${vl.meta.eligibleOperators} eligible, ${vl.operators.length} shown, ${vl.meta.candidates} candidate(s)`);
if (failures) { console.error(`PARITY FAILED: ${failures} mismatch(es)`); process.exit(1); }
console.log('  ✓ ReadModel matches the batch ledgerReader reference exactly');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalize,
  sha256,
  MerkleAccumulator,
  buildPrecommit,
  experimentHash,
  appendEntry,
  verifyChain,
  sessionZ,
  stoufferZ,
  type ExperimentDefinition,
  type PrecommitInput,
  type LedgerEntry,
} from '../src/index.js';

// ---------- canonicalize ----------
test('canonicalize is independent of key order', () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }));
  assert.equal(canonicalize({ a: 2, b: 1 }), '{"a":2,"b":1}');
});

test('canonicalize rejects floats (portability hazard)', () => {
  assert.throws(() => canonicalize({ x: 1.5 }));
});

// ---------- hashing ----------
test('sha256 matches the empty-string vector', () => {
  assert.equal(
    sha256(''),
    'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

// ---------- merkle ----------
test('merkle root is deterministic and data-sensitive', () => {
  const a = new MerkleAccumulator();
  const b = new MerkleAccumulator();
  const c = new MerkleAccumulator();
  a.add(Uint8Array.of(1));
  a.add(Uint8Array.of(2));
  b.add(Uint8Array.of(1));
  b.add(Uint8Array.of(2));
  c.add(Uint8Array.of(1));
  c.add(Uint8Array.of(3));
  assert.equal(a.root(), b.root());
  assert.notEqual(a.root(), c.root());
  assert.match(a.root(), /^sha256:[0-9a-f]{64}$/);
});

// ---------- experiment definitions ----------
const exp: ExperimentDefinition = {
  id: 'binary-micropk',
  version: 1,
  title: 'test',
  kind: 'micro-pk-binary',
  params: { trialBits: 200 },
  intentions: ['HIGH', 'LOW', 'BASELINE'],
};

test('experiment hash changes when any parameter changes', () => {
  assert.notEqual(experimentHash(exp), experimentHash({ ...exp, params: { trialBits: 201 } }));
});

// ---------- pre-commitment + anchor ----------
const baseInput: PrecommitInput = {
  experimentId: 'binary-micropk',
  experimentVersion: 1,
  experimentHash: experimentHash(exp),
  intention: 'HIGH',
  operatorPubKey: 'ed25519:abc',
  beacon: { source: 'drand', round: 1, value: 'ff' },
  sessionId: 's1',
  serverNonce: 'n1',
  prevHash: sha256('prev'),
};

test('precommit is deterministic', () => {
  assert.equal(buildPrecommit(baseInput).precommit, buildPrecommit(baseInput).precommit);
});

test('precommit changes if the declared intention changes (tamper-evident)', () => {
  assert.notEqual(
    buildPrecommit(baseInput).precommit,
    buildPrecommit({ ...baseInput, intention: 'LOW' }).precommit,
  );
});

test('anchor is formatted XXXX-XXXX-XXXX in Crockford base32', () => {
  assert.match(buildPrecommit(baseInput).anchor, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
});

// ---------- ledger chain ----------
test('ledger verifies an intact chain and detects tampering', () => {
  const g = appendEntry(null, 'genesis', { note: 'genesis' });
  const o = appendEntry(g, 'session.open', { sessionId: 's1' });
  const s = appendEntry(o, 'session.seal', { sessionId: 's1', nSamples: 200, ones: 96 });
  const chain: LedgerEntry[] = [g, o, s];
  assert.equal(verifyChain(chain), -1);

  // Mutating a sealed payload must be detected at its index.
  const tampered: LedgerEntry[] = structuredClone(chain);
  (tampered[1]!.payload as { sessionId: string }).sessionId = 'EVIL';
  assert.equal(verifyChain(tampered), 1);

  // Dropping an entry (deletion) breaks the chain too.
  assert.notEqual(verifyChain([g, s]), -1);
});

// ---------- scoring ----------
test('session z is 0 at exactly 50%', () => {
  assert.ok(Math.abs(sessionZ(90000, 180000)) < 1e-9);
});

test('stouffer combines independent z-scores', () => {
  assert.ok(Math.abs(stoufferZ([1, 1, 1, 1]) - 2) < 1e-9);
});

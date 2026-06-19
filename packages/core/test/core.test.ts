import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalize,
  sha256,
  MerkleAccumulator,
  buildPrecommit,
  commitHash,
  experimentHash,
  choiceVocabulary,
  isValidChoice,
  appendEntry,
  verifyChain,
  sessionZ,
  hitRateZ,
  displayZFromSeal,
  derivePrecogTarget,
  trialCommit,
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

// Hash-drift guard (D13): adding the optional `choices`/`stimuli` fields to the
// TYPE must not change the hash of a definition that omits them — canonicalize
// drops undefined keys, so existing sealed micro-PK sessions keep verifying.
test('experiment hash is unchanged by omitted optional fields', () => {
  const withUndefined = { ...exp, choices: undefined, stimuli: undefined } as ExperimentDefinition;
  assert.equal(experimentHash(withUndefined), experimentHash(exp));
});

// ---------- choice vocabulary (kind-agnostic) ----------
test('choiceVocabulary reads intentions (micro-PK) or choices (other kinds)', () => {
  assert.deepEqual(choiceVocabulary(exp), ['HIGH', 'LOW', 'BASELINE']);
  const precog: ExperimentDefinition = {
    id: 'precognition-presentiment', version: 1, title: 'p',
    kind: 'precognition-presentiment', params: {}, choices: ['A', 'B'],
  };
  assert.deepEqual(choiceVocabulary(precog), ['A', 'B']);
  assert.ok(isValidChoice(precog, 'A') && !isValidChoice(precog, 'Z'));
  assert.ok(isValidChoice(exp, 'HIGH') && !isValidChoice(exp, 'A'));
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

// Golden vectors (D13 / cross-language parity): if either of these changes, the
// canonical form drifted and EVERY previously sealed session would stop
// verifying. They must only ever change with a deliberate, versioned migration.
test('experimentHash + precommit match frozen golden vectors', () => {
  assert.equal(experimentHash(exp), 'sha256:ab17b4de0bb85f1e8ccc0fd8c1b357cf044087a79e0df358959b37a6fcc96d07');
  assert.equal(buildPrecommit(baseInput).precommit, 'sha256:b227153c997510ed4ea20331c4ff6b4e9482c0997d2d46d7568d84c5c275595e');
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

test('hit-rate z is 0 at the chance rate and positive above it', () => {
  assert.ok(Math.abs(hitRateZ(50, 100, 0.5)) < 1e-9); // exactly chance
  assert.ok(hitRateZ(60, 100, 0.5) > 0); // above chance
  // 2-of-2-options, 20 trials, 15 hits: z = (15-10)/sqrt(20*0.25) = 5/sqrt(5)
  assert.ok(Math.abs(hitRateZ(15, 20, 0.5) - 5 / Math.sqrt(5)) < 1e-9);
});

test('displayZFromSeal dispatches on payload shape (micro-PK vs precog)', () => {
  assert.ok(Math.abs(displayZFromSeal({ ones: 90000, nSamples: 180000 })!) < 1e-9);
  assert.ok(Math.abs(displayZFromSeal({ hits: 10, trials: 20, optionsPerTrial: 2 })!) < 1e-9);
  assert.ok(displayZFromSeal({ hits: 15, trials: 20, optionsPerTrial: 2 })! > 0);
  assert.equal(displayZFromSeal(null), null);
  assert.equal(displayZFromSeal({ unrelated: 1 }), null);
});

// ---------- generic content commitment (precog trials, spec §7.5) ----------
test('commitHash equals sha256 of the canonical form and is order-independent', () => {
  const v = { sessionId: 's1', trialIndex: 0, choice: 'A', targetRound: 42 };
  assert.equal(commitHash(v), sha256(canonicalize(v)));
  assert.equal(commitHash({ b: 1, a: 2 }), commitHash({ a: 2, b: 1 }));
});

// ---------- precognition target derivation (spec §7.5) ----------
test('derivePrecogTarget is deterministic, in range, and matches Python parity vectors', () => {
  const B = 'deadbeef'.repeat(8);
  // Frozen vectors — analysis/analyze.py must reproduce these exactly.
  assert.deepEqual([0, 1, 2, 3].map((i) => derivePrecogTarget(B, i, 2)), [1, 1, 0, 0]);
  assert.deepEqual([0, 1, 2, 3].map((i) => derivePrecogTarget(B, i, 3)), [1, 2, 0, 2]);
  // In range for any k, and stable across calls.
  for (let k = 2; k <= 7; k++) {
    const t = derivePrecogTarget(B, 11, k);
    assert.ok(t >= 0 && t < k && Number.isInteger(t));
    assert.equal(t, derivePrecogTarget(B, 11, k));
  }
  assert.throws(() => derivePrecogTarget(B, 0, 1));
});

test('trialCommit matches the frozen golden vector (cross-language parity)', () => {
  assert.equal(
    trialCommit({ sessionId: 's1', trialIndex: 0, choice: 'A', targetRound: 100, prevBeaconRound: 98, operatorPubKey: 'ed25519:abc' }),
    'sha256:6ecdfac93181f0112e2654a3cec7c7cb65fc700318937a4350824d649f7d2e81',
  );
});

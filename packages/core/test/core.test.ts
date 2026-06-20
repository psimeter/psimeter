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
  derivePresentimentTarget,
  trialCommit,
  stoufferZ,
  directionalZ,
  psiScore,
  psiScoreFromSessions,
  invNormalCdf,
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

// ---------- presentiment target derivation (spec §7.5) ----------
test('derivePresentimentTarget matches frozen Python parity vectors', () => {
  const B = 'deadbeef'.repeat(8);
  // {valence, imageIndex} for pools calm=10, aversive=7. analyze.py + browser
  // /verify must reproduce these exactly.
  const got = [0, 1, 2, 3, 4, 5].map((i) => derivePresentimentTarget(B, i, 10, 7));
  assert.deepEqual(got, [
    { valence: 1, imageIndex: 2 },
    { valence: 0, imageIndex: 4 },
    { valence: 0, imageIndex: 5 },
    { valence: 0, imageIndex: 1 },
    { valence: 0, imageIndex: 9 },
    { valence: 1, imageIndex: 6 },
  ]);
});

test('derivePresentimentTarget: valence is a fair coin; index stays in its pool', () => {
  const B = 'deadbeef'.repeat(8);
  let ones = 0;
  for (let i = 0; i < 1000; i++) {
    const t = derivePresentimentTarget(B, i, 10, 7);
    assert.ok(t.valence === 0 || t.valence === 1);
    assert.ok(t.imageIndex >= 0 && t.imageIndex < (t.valence === 0 ? 10 : 7));
    ones += t.valence;
  }
  assert.ok(Math.abs(ones / 1000 - 0.5) < 0.05, `valence balance ${ones / 1000}`);
  assert.throws(() => derivePresentimentTarget(B, 0, 0, 0));
});

test('trialCommit matches the frozen golden vector (cross-language parity)', () => {
  assert.equal(
    trialCommit({ sessionId: 's1', trialIndex: 0, choice: 'A', targetRound: 100, prevBeaconRound: 98, operatorPubKey: 'ed25519:abc' }),
    'sha256:6ecdfac93181f0112e2654a3cec7c7cb65fc700318937a4350824d649f7d2e81',
  );
});

// ---------- psi score: anytime-valid per-operator e-value (spec D15 / H1) ----------

test('directionalZ orients by declared intention; BASELINE/unknown never score', () => {
  assert.equal(directionalZ('HIGH', 3), 3); // micro-PK: bias toward 1s
  assert.equal(directionalZ('LOW', 3), -3); // micro-PK: bias toward 0s
  assert.equal(directionalZ('BASELINE', 3), null); // calibration only (D5)
  assert.equal(directionalZ('', 3), 3); // per-trial kinds (precognition): already oriented
  assert.equal(directionalZ('HIGH', null), null); // unsealed / no z
  assert.equal(directionalZ('whatever', 3), null); // unknown session-level vocabulary
});

test('psi score starts at exactly 1 (0 points) with no sessions', () => {
  const s = psiScore([]);
  assert.equal(s.scoredSessions, 0);
  assert.ok(Math.abs(s.wealth - 1) < 1e-12);
  assert.equal(s.points, 0);
  assert.equal(s.sigma, 0);
  assert.equal(s.tierName, 'Baseline');
  assert.equal(s.isCandidate, false);
});

// Frozen golden vector: one session at directional z = 3, grid [0.1,0.2,0.4,0.8],
// equal weights. W = mean_j exp(δ_j·3 − δ_j²/2). analyze.py must reproduce this.
test('psi wealth matches the frozen golden vector (cross-language parity)', () => {
  const s = psiScore([3]);
  assert.ok(Math.abs(s.wealth - 3.5496219767564274) < 1e-9, `wealth ${s.wealth}`);
  assert.equal(s.points, 6); // round(10·log10(3.54962))
});

test('psi is one-sided: deviation against the declared direction never scores', () => {
  const s = psiScore([-3]);
  assert.ok(s.wealth < 1, `wealth ${s.wealth}`);
  assert.equal(s.points, 0); // below chance reads as 0 points, not negative
  assert.equal(s.anytimeP, 1);
  assert.equal(s.sigma, 0);
});

test('candidate badge needs BOTH the wealth threshold and the session floor', () => {
  const five = psiScore([3, 3, 3, 3, 3]);
  assert.ok(five.wealth >= 1000);
  assert.equal(five.isCandidate, true);
  assert.equal(five.tierName, 'Candidate');

  // Same per-session strength but only 4 sessions: wealth still clears 1000, yet
  // the badge is withheld and the tier is held one rung below.
  const four = psiScore([3, 3, 3, 3]);
  assert.ok(four.wealth >= 1000);
  assert.equal(four.isCandidate, false);
  assert.equal(four.tierName, 'Strong signal');
});

test('psiScoreFromSessions drops BASELINE/unsealed and orients HIGH/LOW', () => {
  const s = psiScoreFromSessions([
    { choice: 'HIGH', z: 3 },
    { choice: 'LOW', z: -3 }, // -(-3) = +3 toward declared LOW
    { choice: 'BASELINE', z: 5 }, // excluded
    { choice: '', z: 2 }, // precognition
    { choice: 'HIGH', z: null }, // unsealed
  ]);
  assert.equal(s.scoredSessions, 3);
  assert.ok(Math.abs(s.sumZ - 8) < 1e-12);
});

test('invNormalCdf inverts the standard normal at known points', () => {
  assert.ok(Math.abs(invNormalCdf(0.5)) < 1e-9);
  assert.ok(Math.abs(invNormalCdf(0.975) - 1.959963985) < 1e-6);
});

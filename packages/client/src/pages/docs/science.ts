// The science chapters: the two hypotheses (§5), the experiments (D13/D14/§7.5),
// what a result means (D4/D5/D13), and the psi score (D15).

import type { Child } from '../../ui';
import { P, REF } from './paths';
import { h2, p, lead, b, em, code, pre, ul, ol, link, ext, callout, warn, defs } from './prose';

export function renderHypotheses(): Child[] {
  return [
    lead(
      'PsiMeter tests two distinct, pre-registered hypotheses. They are deliberately separated because they demand different analyses and different safeguards. Neither claims that “anomalies occur” — anomalies are guaranteed by chance. They ask something far harder to fake.',
    ),

    h2('h1', 'H1 — individual consistency'),
    p(em('“Some specific people can reliably influence the RNG, across their own sessions.”')),
    p(
      'The claim is not that unusual sessions happen, but that ', b('particular individuals'),
      ' produce above-chance deviation ', b('consistently'), ', in the direction they declared, over many of their own sessions.',
    ),
    ul([
      [b('Clean unit of analysis: '), 'the within-operator HIGH−LOW difference. Because the same person runs both intentions interleaved, any static per-operator or per-hardware quirk cancels — only the intention differs.'],
      [b('Primary statistic: '), 'the within-operator effect with a credible interval, plus split-half / test–retest reliability — does an operator’s effect in the first half of their sessions predict the second half? A stable ability implies a positive correlation, which is very hard to produce by chance or to fake.'],
      [b('Public surface: '), 'this per-operator statistic is the gamified ', link(P.psiScore, 'psi score'), ' — an anytime-valid test martingale, ranked on the leaderboard, with a “candidate” flag.'],
    ]),

    h2('h2', 'H2 — excess corpus deviation'),
    p(em('“Across the whole corpus, there are more anomalies than chance allows.”')),
    p(
      'Across the large corpus, does the distribution of session scores deviate from the ', b('empirically calibrated'),
      ' null — a mean shift, variance inflation, or an excess of extreme tails (|Z| > 3, 4, 5)? Crucially, the comparison is intention runs vs. operator-absent ',
      link(P.results, 'baseline runs'), ' through the identical pipeline — never against a merely assumed perfect coin, because a real hardware source has its own measured bias.',
    ),
    p(
      'The headline effect is the directional HIGH−LOW contrast (which cancels static bias). And to defend against the “PEAR Operator 10” risk — one heavy or fraudulent user manufacturing the corpus result — the analysis pre-registers a ',
      b('leave-one-operator-out'), ' and ', b('per-operator-capped'), ' version.',
    ),

    h2('two-phase', 'The two-phase architecture'),
    p('Both hypotheses run in two phases — this is what makes screening millions of sessions statistically legitimate:'),
    defs([
      ['Exploratory / screening', ['The open firehose: anyone, unlimited sessions. Generates hypotheses and flags candidate operators. Pre-registered as exploratory and ', b('never'), ' cited as confirmation.']],
      ['Confirmatory', ['Frozen hypotheses, fixed N, a defined stopping rule, and an analysis script registered ', b('before'), ' the data is generated. For H1, this is the replication of screened candidates; for H2, a pre-declared block analyzed once.']],
    ]),
    callout(
      'Why two phases? Screening thousands of operators ', b('will'), ' throw up chance “talents” (the ',
      link(P.results, 'multiple-comparisons'), ' problem). The exploratory phase is allowed to find them; only a fresh, pre-registered replication can confirm one. The flag is a starting line, not a finish line.',
    ),
  ];
}

export function renderExperiments(): Child[] {
  return [
    lead(
      'PsiMeter isn’t one test — it’s a growing set of experiments behind a single shared trust spine. Only the choice vocabulary, the generation/reveal protocol, and the scoring differ per kind. Two experiments ship today.',
    ),

    h2('micropk', 'Binary micro-PK'),
    p(
      'You try to bias a live physical random process while it runs. Before the run you declare ',
      code('HIGH'), ', ', code('LOW'), ', or ', code('BASELINE'),
      '; then a stream of raw random bits is generated server-side and streamed one-way to your screen, and the feed shows whether the running total drifts your way.',
    ),
    p('The defaults are anchored to the classic PEAR random-event-generator protocol (', ext(REF.pear, 'PEAR'), '):'),
    pre(
`binary-micropk v1
  trialBits           = 200      # one trial = Binomial(200, ½): mean 100, SD ≈ 7.071
  bitRatePerSec       = 1000
  sessionSeconds      = 180      # ⇒ 900 trials, 180,000 bits per session
  intentionAssignment = volitional   # (PEAR also ran "instructed" — itself a parameter)
  conditioning        = raw          # unconditioned bits (see "Randomness & entropy")
  checkpointEveryTrials = 5          # ~1 s visual cadence`,
    ),
    p(
      'The three-way HIGH / LOW / BASELINE design (', em('tripolar'),
      ') is what lets the confirmatory test compare HIGH vs LOW and cancel any static generator bias. The bit-to-trial mapping is frozen at launch and never changed.',
    ),
    warn(
      b('Honest power note. '),
      'The canonical micro-PK effect is about 1–2×10⁻⁴ per bit. A single 180k-bit session has an SD of ≈ 1.18×10⁻³ in proportion, so a canonical-size effect contributes only z ≈ 0.13 to one session — negligible. ',
      'All real inference therefore lives in ', em('aggregation'), ' across many sessions and people. This is exactly why the platform is built for scale, and why ',
      link(P.results, 'a single session is not evidence'), '.',
    ),

    h2('presentiment', 'Presentiment (forced-choice precognition)'),
    p(
      'You commit a choice ', em('before'),
      ' the target exists. Each ~2-minute session is a fixed number of forced-choice trials. On each trial you are ',
      em('destined'),
      ' to be shown either a calming or an unpleasant real image — selected by a ', b('future'),
      ' beacon round that has not been published yet — and you must predict the valence you sense is coming. Then the actual image appears full-screen (~4 s), so the emotion genuinely lands. A hit is correctly anticipating the valence that then hits you.',
    ),
    p('This is the ', ext(REF.bem2011, 'Bem'), ' / ', ext(REF.mossbridge2012, 'Bierman–Radin presentiment'), ' paradigm. The per-trial sequence (two-way WebSocket):'),
    ol([
      ['The server prompts a ', code('trial'), '; you feel and predict.'],
      ['You send your ', code('choice'), '; the server reads the latest beacon round R₀ and binds a future target round R = R₀ + offset.'],
      ['Your browser signs a commit over ', code('{sessionId, trialIndex, choice, R, R₀, operatorPubKey}'), ' — proving the choice preceded R.'],
      ['The server waits for R, ', b('BLS-verifies'), ' the beacon value B_R, and derives the target: ', code('valence = SHA256(B_R ‖ uint32(trialIndex))[0] & 1'), ' — an exact fair coin — with the image index from a disjoint digest slice mod the pool size.'],
      ['The committed image is revealed and the hit scored.'],
    ]),
    p(
      'The target source is the ', b('future drand round only'),
      ' — fully reproducible by anyone, with zero trust in the server’s entropy. The stimuli are a curated CC0 image corpus whose exact pixels are content-hash-pinned into the ',
      link(P.crypto, 'experiment definition'),
      ', so a verifier can re-hash the served bytes. Strong/aversive content sits behind a one-time content-warning consent gate.',
    ),
    callout(
      'Presentiment is statistically the ', em('cleaner'),
      ' of the two experiments: its chance rate is an exact, beacon-derived 50/50 with no hardware bias to calibrate away. Two-way comms is safe here precisely because the image is bound to a round nobody can predict at choice time — there is no channel to game (contrast micro-PK’s one-way isolation).',
    ),

    h2('shared', 'One spine, many experiments'),
    p(
      'Both kinds share the same provenance machinery (commit → sign → beacon → Merkle → ledger → anchor → ',
      link(P.witnesses, 'witness'),
      '); each has its own pre-registered analysis. New experiment kinds plug into a thin registry without touching the trust core — see ',
      link(P.architecture, 'architecture'), ' and ', link(P.decisions, 'decision D14'), '.',
    ),
  ];
}

export function renderResults(): Child[] {
  return [
    lead(
      'This is where most psi claims go wrong, so it gets its own chapter. With many sessions in the database, extreme-looking individual runs are not just possible — they are ',
      b('guaranteed'),
      '. The scientific question is never one run; it is whether someone beats chance consistently, measured against the right yardstick.',
    ),

    h2('not-evidence', 'What is NOT evidence'),
    ul([
      [b('A single hot session. '), 'Even under the textbook psi effect size, a few minutes of data carries a vanishingly small signal (see the ', link(P.experiments, 'power note'), '). A high score is a fun moment, nothing more.'],
      [b('Topping the leaderboard once. '), 'Across thousands of players, someone will look gifted by pure chance. That is exactly why a “candidate” must replicate before anything is claimed.'],
      [b('A result picked after the fact. '), 'Cherry-picking from a sea of runs proves nothing; the confirmatory test must be fixed in advance via ', link(P.hypotheses, 'pre-registration'), '.'],
    ]),
    callout(
      b('The leaderboard is not evidence. '),
      'It is an engagement and transparency feature. With millions of sessions, multi-sigma runs occur by chance even if no effect exists, so a naïve “anomaly leaderboard” would be statistically empty and would actively discredit the project. The headline science is the pre-registered aggregate test — decision ',
      link(P.decisions, 'D4'), '.',
    ),

    h2('calibrated-null', 'The calibrated null'),
    p(
      'A real physical generator is never a perfect 50/50 coin — it has tiny static biases of its own. So results are ',
      b('not'),
      ' scored against a textbook coin. They are scored against the generator’s own measured behaviour, characterized from large ',
      b('operator-absent'),
      ' control runs through the identical code path (decision ', link(P.decisions, 'D5'), '). We use the empirical mean, variance, and autocorrelation when they differ from the theoretical values, and run continuous randomness test suites on the baseline — see ',
      link(P.entropy, 'randomness & entropy'), '.',
    ),

    h2('multiple-comparisons', 'Multiple comparisons & the firehose'),
    p(
      'If you test enough people, some will look special by luck alone — the multiple-comparisons problem. PsiMeter does not pretend this away; it ',
      b('builds around it'),
      ': the open firehose is explicitly exploratory, the leaderboard shows the ',
      em('expected-by-chance'),
      ' candidate count alongside the real one, and only a fresh, pre-registered replication (the ',
      link(P.hypotheses, 'confirmatory phase'),
      ') can turn a flagged candidate into a finding.',
    ),

    h2('where-signal-lives', 'Where the signal actually lives'),
    ul([
      [b('Consistency, measured honestly. '), 'The ', link(P.psiScore, 'psi score'), ' only climbs if you beat chance in your declared direction, repeatedly. Under pure luck it stays near zero no matter how long you play.'],
      [b('A candidate who replicates. '), 'Crossing the threshold flags you for a separate, fixed-N test. The replication is the proof — not the flag.'],
      [b('The pre-registered aggregate. '), 'Across many sessions, against the generator’s own calibrated baseline, with leave-one-operator-out robustness — never a result spotted afterward.'],
    ]),
  ];
}

export function renderPsiScore(): Child[] {
  return [
    lead(
      'The leaderboard ranks people, not sessions. The psi score is one number per operator that measures how consistently they beat chance in the direction they declared, across their own sessions — H1 made public and gamified. It is designed so that a live, continuously-updated, “stop whenever you like” score is still scientifically legitimate.',
    ),

    h2('problem', 'The problem it solves'),
    p(
      'Players will naturally stop at a favourable peak — operator-level optional stopping, the exact failure mode that pre-registration forbids ',
      em('within'),
      ' a session. A naïve fixed-N z-score, watched live and abandoned at a good moment, would be a license to manufacture significance. The fix is to use a statistic that is valid no matter when you look.',
    ),

    h2('martingale', 'An anytime-valid test martingale (e-value)'),
    p(
      'The score is a ', b('test martingale'), ' — equivalently an ', em('e-value'),
      ' (', ext(REF.savi, 'Ramdas, Grünwald, Vovk & Shafer, 2023'),
      '). Picture a betting game against the null “it’s all just chance.” You start with $1 of wealth; each session you bet that your declared-direction success rate is a little above chance. Under the null, the wealth W is a non-negative martingale with E[W] = 1 — it drifts down about as often as up. It only trends upward if something real is moving outcomes your way.',
    ),
    p('The validity guarantee is ', ext(REF.ville, 'Ville’s inequality'), ':'),
    pre('P( sup_t  W_t  ≥  1/α )  ≤  α'),
    p(
      'In words: the probability that your wealth ', b('ever'),
      ' reaches 1000× is at most 1/1000 under the null. So you may monitor it live, stop whenever, and even rank the leaderboard by ',
      em('peak'),
      ' wealth — the false-positive guarantee still holds. This is the one construction that makes a live, gamified, continuously-updated per-person evidence score honest.',
    ),

    h2('construction', 'The construction (kind-agnostic)'),
    p(
      'Each scored session contributes a directional per-session z, ', code('d_i'),
      ' (micro-PK HIGH→+z, LOW→−z; BASELINE calibrates and is excluded; precognition’s hit-rate z is already oriented). Under the null, ',
      code('d_i ~ N(0,1)'),
      '. We bet against the null with a fixed one-sided mixture over a grid of alternative effect sizes:',
    ),
    pre(
`W = mean_j  exp( δ_j·S − n·δ_j²/2 )      with  S = Σ d_i
grid  PSI_ALT_GRID = [0.1, 0.2, 0.4, 0.8]   (equal weights)`,
    ),
    p(
      'Each component is a martingale (', code('E[exp(δZ − δ²/2)] = 1'),
      '), so the mixture is too; it is one-sided (all δ > 0), so only declared-direction effect builds wealth. ',
      b('Any fixed grid is valid'),
      ' under Ville — the grid affects power, never validity. It is implemented for display in ',
      code('packages/core/src/psi.ts'),
      ' and recomputed authoritatively in ', code('analysis/analyze.py'),
      '; a frozen golden vector guards cross-language parity.',
    ),

    h2('display', 'Points, odds, and tiers'),
    p('The displayed points are ', b('decibans'), ' — I.J. Good’s weight of evidence (', ext(REF.deciban, 'the ban / deciban'), '):'),
    pre('points = 10 · log10(W)      # 0 at chance, +10 per 10× of evidence'),
    p('Alongside the points the score shows the odds against chance (W : 1) and a sigma-equivalent (Φ⁻¹(1 − 1/W)). The ladder:'),
    defs([
      ['Baseline', ['the starting tier — everyone begins at exactly 0.']],
      ['Flicker', ['W ≥ 3 (≈ 5 points).']],
      ['Signal', ['W ≥ 10 (10 points ≈ 10-to-1 odds).']],
      ['Strong signal', ['W ≥ 100 (20 points ≈ 100-to-1).']],
      ['Candidate', ['W ≥ 1000 (30 points ≈ 1000-to-1) ', b('and'), ' ≥ 5 scored sessions.']],
    ]),

    h2('candidate', 'Candidate ≠ proof'),
    callout(
      'Reaching “Candidate” means ', b('flagged for a separate, pre-registered, fixed-N confirmatory replication'),
      ' — never “proven psi.” The ≥ 5-session requirement stops one lucky run from qualifying. Across many players some candidates are expected by chance alone, and the leaderboard shows that expected count (',
      code('eligibleOperators / 1000'),
      ') right next to the real one — which is precisely why a candidate must replicate.',
    ),

    h2('robustness', 'Residual risks & honesty'),
    ul([
      [b('Static-bias confound (micro-PK only). '), 'A one-sided-intention operator could in principle accrue wealth from a biased source rather than psi. Mitigated by HIGH/LOW balance; the confirmatory analysis centers on the ', link(P.results, 'calibrated baseline'), ' and the HIGH−LOW contrast. Presentiment is unaffected (exact beacon-derived fair coin).'],
      [b('Sybil / multi-key fishing. '), 'Minting many browser keys just buys more lottery tickets — the multiple-comparisons problem again, answered by the confirmatory phase plus optional stronger identity for flagged candidates, not on the firehose.'],
      [b('Experimenter-as-subject. '), 'The score is recomputable from the public ledger by anyone, never server-asserted, so the owner topping his own leaderboard is independently checkable (decision ', link(P.decisions, 'D12'), ').'],
    ]),
    p(
      'Crossing the threshold unlocks a voluntary contact form: the operator ',
      b('signs a canonical challenge'),
      ' (proving custody of the key whose public score earned eligibility), and the chosen contact detail is stored privately, off-ledger — the single, deliberate, operator-initiated break in pseudonymity. Everything else stays anonymous.',
    ),
  ];
}

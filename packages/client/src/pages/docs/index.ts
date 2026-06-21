// The documentation-wiki chapter registry: one ordered source of truth that
// drives the sidebar table of contents, the per-chapter routes, and prev/next.
// Adding a chapter is: write its render fn, add one entry here. (spec §10.1)

import type { Child } from '../../ui';
import type { Route } from '../../router';
import { P } from './paths';
import { renderDocChapter } from './layout';
import { renderStart, renderPrinciple, renderGlossary } from './orientation';
import { renderHypotheses, renderExperiments, renderResults, renderPsiScore } from './science';
import { renderProvenance, renderCrypto, renderEntropy, renderWitnesses, renderThreat } from './trust';
import { renderVerify, renderRun, renderArchitecture } from './diy';
import { renderDecisions, renderReferences } from './reference';

export interface DocChapter {
  id: string;
  path: string;
  group: string;
  title: string;
  blurb: string;
  render: () => Child[];
}

/** Sidebar groups, in display order. */
export const DOC_GROUPS = [
  'Orientation',
  'The science',
  'The trust machinery',
  'Verify & run it yourself',
  'Reference',
] as const;

/** All chapters, in reading (and prev/next) order. */
export const DOC_CHAPTERS: DocChapter[] = [
  { id: 'start', path: P.start, group: 'Orientation', title: 'Start here', blurb: 'What PsyMeter is and how to read these docs.', render: renderStart },
  { id: 'principle', path: P.principle, group: 'Orientation', title: 'Why you don’t have to trust us', blurb: 'The untrusted-experimenter principle and the seven design pillars.', render: renderPrinciple },
  { id: 'glossary', path: P.glossary, group: 'Orientation', title: 'Glossary', blurb: 'Every term, defined.', render: renderGlossary },

  { id: 'hypotheses', path: P.hypotheses, group: 'The science', title: 'The two hypotheses', blurb: 'H1 (individual consistency) and H2 (excess corpus deviation).', render: renderHypotheses },
  { id: 'experiments', path: P.experiments, group: 'The science', title: 'The experiments', blurb: 'Binary micro-PK and presentiment, protocols and parameters.', render: renderExperiments },
  { id: 'results', path: P.results, group: 'The science', title: 'What a result means', blurb: 'Why a single session is never evidence; the calibrated null.', render: renderResults },
  { id: 'psi-score', path: P.psiScore, group: 'The science', title: 'The psi score', blurb: 'E-values, test martingales, Ville’s inequality, decibans.', render: renderPsiScore },

  { id: 'provenance', path: P.provenance, group: 'The trust machinery', title: 'The provenance spine', blurb: 'The full commit → generate → seal → verify sequence.', render: renderProvenance },
  { id: 'cryptography', path: P.crypto, group: 'The trust machinery', title: 'Cryptographic building blocks', blurb: 'Commitments, Merkle, hash chains, Ed25519, the beacon, anchoring.', render: renderCrypto },
  { id: 'entropy', path: P.entropy, group: 'The trust machinery', title: 'Randomness & entropy', blurb: 'The entropy ladder, raw bits, and randomness testing.', render: renderEntropy },
  { id: 'witnesses', path: P.witnesses, group: 'The trust machinery', title: 'Live witnesses', blurb: 'Independent real-time co-signers (D16).', render: renderWitnesses },
  { id: 'threat-model', path: P.threat, group: 'The trust machinery', title: 'Threat model & residual trust', blurb: 'What is closed, and what honestly is not — yet.', render: renderThreat },

  { id: 'verify', path: P.verify, group: 'Verify & run it yourself', title: 'Verify a result yourself', blurb: 'In the browser, and offline with analyze.py.', render: renderVerify },
  { id: 'run', path: P.run, group: 'Verify & run it yourself', title: 'Run it yourself', blurb: 'Self-host the instrument, run a witness node, corroborate data.', render: renderRun },
  { id: 'architecture', path: P.architecture, group: 'Verify & run it yourself', title: 'Architecture & repo layout', blurb: 'The trust-path principle, the stack, the monorepo.', render: renderArchitecture },

  { id: 'decisions', path: P.decisions, group: 'Reference', title: 'Decision log (D1–D16)', blurb: 'Every numbered design decision and its rationale.', render: renderDecisions },
  { id: 'references', path: P.references, group: 'Reference', title: 'References & further reading', blurb: 'All external sources, annotated.', render: renderReferences },
];

/** Route table to spread into the app router (each /docs[/...] path). */
export function docsRoutes(): Record<string, Route> {
  const routes: Record<string, Route> = {};
  for (const ch of DOC_CHAPTERS) {
    routes[ch.path] = (outlet) => renderDocChapter(outlet, ch.id);
  }
  return routes;
}

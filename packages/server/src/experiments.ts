import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ExperimentDefinition } from '@psymeter/core';

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root `experiments/` directory (packages/server/src → ../../../experiments). */
const EXPERIMENTS_DIR = resolve(here, '../../../experiments');

/**
 * Load a versioned, immutable experiment definition from disk (spec D13).
 * The caller binds `experimentHash(def)` into every session's pre-commitment,
 * so the exact parameter set loaded here is cryptographically pinned.
 */
export function loadExperiment(id: string, version: number): ExperimentDefinition {
  const path = resolve(EXPERIMENTS_DIR, `${id}-v${version}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as ExperimentDefinition;
}

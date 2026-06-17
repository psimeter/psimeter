import { canonicalize } from './canonicalize.js';
import { sha256 } from './hash.js';
import type { Intention } from './types.js';

/**
 * A versioned, immutable experiment definition (spec D13).
 *
 * Parameters are configurable, but a definition is CONTENT-ADDRESSED: its hash
 * is bound into every session's pre-commitment, so a parameter set can never be
 * changed silently. Any change REQUIRES a version bump and yields a new hash,
 * which partitions the corpus — incompatible parameter sets are never pooled.
 *
 * NOTE: `params` may contain only integers and strings (see canonicalize), so a
 * definition is committable. Derived real-valued quantities (e.g. a trial's
 * standard deviation) are computed from these integers, never stored here.
 */
export interface ExperimentDefinition {
  id: string;
  version: number;
  title: string;
  kind: string;
  params: Record<string, unknown>;
  intentions: Intention[];
}

/** Stable content hash of an experiment definition ("sha256:…"). */
export function experimentHash(def: ExperimentDefinition): string {
  return sha256(canonicalize(def));
}

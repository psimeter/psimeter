import { canonicalize } from './canonicalize.js';
import { sha256 } from './hash.js';
import type { Choice, ExperimentKind, Intention } from './types.js';

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
  kind: ExperimentKind;
  params: Record<string, unknown>;
  /**
   * The committable choice vocabulary. Micro-PK uses `intentions`
   * (HIGH/LOW/BASELINE); newer kinds use `choices` (option ids). Read both via
   * `choiceVocabulary`. Keeping `intentions` on the existing file unchanged
   * preserves its content hash (D13) and thus every sealed micro-PK session.
   */
  intentions?: Intention[];
  choices?: Choice[];
  /** Optional, kind-specific presentation data (e.g. a precognition stimulus
   * palette). Part of the content hash, so it is frozen per version like params. */
  stimuli?: Record<string, unknown>;
}

/** Stable content hash of an experiment definition ("sha256:…"). */
export function experimentHash(def: ExperimentDefinition): string {
  return sha256(canonicalize(def));
}

/**
 * The committable choice vocabulary for a definition, regardless of which field
 * a given kind uses. Returns `choices` when present, else `intentions`, else [].
 */
export function choiceVocabulary(def: ExperimentDefinition): Choice[] {
  return def.choices ?? def.intentions ?? [];
}

/** True when `choice` is a member of the definition's committable vocabulary. */
export function isValidChoice(def: ExperimentDefinition, choice: Choice): boolean {
  return choiceVocabulary(def).includes(choice);
}

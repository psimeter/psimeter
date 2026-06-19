/**
 * Experiment-kind registry (spec §10).
 *
 * The provenance spine — commit → sign → beacon → Merkle → ledger → anchor — is
 * shared by every experiment. What differs per kind is the choice vocabulary
 * (see `choiceVocabulary` in experiment.ts), the generation/reveal protocol
 * (server-side), and the scoring. This module owns the kind-agnostic *display*
 * scoring so the read APIs, the client, and the live HUD never branch on kind.
 *
 * As always, these numbers are DISPLAY ONLY: the authoritative statistics are
 * recomputed over the published raw data in analysis/analyze.py (spec §8.1).
 */
import { hitRateZ, sessionZ } from './scoring.js';

/** The seal fields a micro-PK session commits (see server session.ts). */
export interface MicroPkSeal {
  ones: number;
  nSamples: number;
}

/** The seal fields a precognition session commits (see server kinds/precog.ts). */
export interface PrecogSeal {
  hits: number;
  trials: number;
  optionsPerTrial: number;
}

function isMicroPkSeal(s: Record<string, unknown>): s is MicroPkSeal & Record<string, unknown> {
  return typeof s.ones === 'number' && typeof s.nSamples === 'number';
}

function isPrecogSeal(s: Record<string, unknown>): s is PrecogSeal & Record<string, unknown> {
  return (
    typeof s.hits === 'number' &&
    typeof s.trials === 'number' &&
    typeof s.optionsPerTrial === 'number'
  );
}

/**
 * Display z-score derived directly from a sealed session's payload, dispatched
 * by the payload's own shape (so it works for both old and new ledger entries
 * without a separate kind lookup). Returns null when the session is not yet
 * sealed or the shape is unrecognised.
 */
export function displayZFromSeal(seal: Record<string, unknown> | null | undefined): number | null {
  if (!seal) return null;
  if (isMicroPkSeal(seal)) return seal.nSamples > 0 ? sessionZ(seal.ones, seal.nSamples) : 0;
  if (isPrecogSeal(seal)) {
    return seal.trials > 0 ? hitRateZ(seal.hits, seal.trials, 1 / seal.optionsPerTrial) : 0;
  }
  return null;
}

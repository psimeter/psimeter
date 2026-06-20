import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Opt-in contact for a psi CANDIDATE (spec D15). When an operator's score crosses
 * the candidate threshold they may *voluntarily* reveal a contact detail so the
 * researcher can reach out for a 1:1 follow-up — the one deliberate break in the
 * platform's pseudonymity, and only ever operator-initiated.
 *
 * This record holds PII (a volunteer's chosen contact). It is therefore kept in a
 * PRIVATE, off-ledger append log — never written to the public hash-chained
 * ledger, never served over /api. The ledger/ directory is git-ignored, so it
 * also never lands in version control. The signature proves the submitter holds
 * the operator key whose public score earned the eligibility.
 */
export interface ContactRecord {
  ts: string;
  operatorPubKey: string;
  /** Free-form contact detail the operator chose to reveal (email, handle, …). */
  contact: string;
  message: string;
  /** Ed25519 signature over the canonical contact challenge (proves key custody). */
  operatorSig: string;
  /** The operator's psi score at submission time (for the researcher's triage). */
  psiPoints: number;
  wealth: number;
}

export function saveContact(path: string, rec: ContactRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(rec) + '\n', 'utf8');
}

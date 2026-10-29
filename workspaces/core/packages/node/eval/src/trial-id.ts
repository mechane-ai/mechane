import { sha256Hex } from '@mechane/program';
import { TRIAL_ID_HEX_CHARS } from './constants.ts';

/** The parts a trial's id derives from. */
type TrialIdInput = { readonly digest: string; readonly caseId: string; readonly repeat: number };

/** A trial's id: the first 128 bits of the SHA-256 of its plan's digest, its case's id and its repeat. */
export function trialId({ digest, caseId, repeat }: TrialIdInput): string {
  return sha256Hex({ contents: JSON.stringify({ digest, case_id: caseId, repeat }) }).slice(0, TRIAL_ID_HEX_CHARS);
}

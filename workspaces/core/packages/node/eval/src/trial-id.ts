import { sha256Hex } from '@mechane/program';
import { EvalTrialId } from './application-schemas.ts';
import { TRIAL_ID_HEX_CHARS } from './constants.ts';
import type { EvalId } from './schemas.ts';

/** The parts a trial's id derives from. */
type TrialIdInput = { readonly digest: string; readonly caseId: EvalId; readonly repeat: number };

/** A trial's id: the first 128 bits of the SHA-256 of its plan's digest, its case's id and its repeat. */
export function trialId({ digest, caseId, repeat }: TrialIdInput): EvalTrialId {
  const contents = JSON.stringify({ digest, case_id: caseId, repeat });
  const sha256 = sha256Hex({ contents });
  const identifier = sha256.slice(0, TRIAL_ID_HEX_CHARS);

  return EvalTrialId.make(identifier);
}

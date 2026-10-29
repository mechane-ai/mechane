import { Effect } from 'effect';
import type { TurnRecord } from '../store/schemas.ts';
import type { EvalRunFailure } from '../types.ts';
import { Role } from './constants.ts';
import { roleTurn } from './role-turn.ts';
import type { RunTrialInput } from './types.ts';

/** The subject's turn: a mech with the suite's subject settings, which receives the case's input and nothing else. */
export const subjectTurn = Effect.fn('subjectTurn')(function* ({
  call,
  access,
  suite,
  evalCase,
  trial,
  files,
}: RunTrialInput): Effect.fn.Return<TurnRecord, EvalRunFailure> {
  const mech = { ...suite.subject, name: `${Role.Subject} ${trial.id}`, dailyCapMicros: suite.trialCapMicros };

  return yield* roleTurn({ call, access, mech, text: evalCase.input, intent: files.subjectIntent });
});

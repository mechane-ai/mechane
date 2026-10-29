import { Effect } from 'effect';
import type { GradeRecord } from '../store/schemas.ts';
import type { EvalRunFailure } from '../types.ts';
import { Role } from './constants.ts';
import { graderOutcome } from './grader-outcome.ts';
import { graderText } from './grader-text.ts';
import { roleTurn } from './role-turn.ts';
import type { RunTrialInput } from './types.ts';

/** A trial to grade, and the subject's reply to its case, which the grader judges. */
type GraderTurnInput = RunTrialInput & { readonly reply: string };

/** The instructions of every grader mech, which the suite cannot change. */
const GRADER_INSTRUCTIONS = [
  'You grade one reply against each expectation of the input it answered, judging only what the reply says.',
  'Answer with one line of JSON and nothing else, of the form',
  '{"summary":"<one sentence>","criteria":[{"id":"<expectation id>","verdict":"pass","evidence":"<a short quote or reason>"}]},',
  'with one criterion for each expectation under its id, whose verdict is pass, fail or uncertain.',
].join(' ');

/** The grader's turn: a mech with the grader's fixed instructions, whose reply grades the case or is no grade. */
export const graderTurn = Effect.fn('graderTurn')(function* ({
  call,
  access,
  suite,
  evalCase,
  trial,
  files,
  reply,
}: GraderTurnInput): Effect.fn.Return<GradeRecord, EvalRunFailure> {
  const mech = {
    ...suite.grader,
    name: `${Role.Grader} ${trial.id}`,
    instructions: GRADER_INSTRUCTIONS,
    dailyCapMicros: suite.trialCapMicros,
  };

  const turn = yield* roleTurn({
    call,
    access,
    mech,
    text: graderText({ evalCase, reply }),
    intent: files.graderIntent,
  });

  return { ...turn, outcome: graderOutcome({ outcome: turn.outcome, expectations: evalCase.expectations }) };
});

import { TurnStatus } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { Intent } from '../schemas.ts';
import type { EvalRunFailure, OnceFile, WriteProgress } from '../types.ts';
import { Role } from './constants.ts';
import { graderTurn } from './grader-turn.ts';
import { subjectTurn } from './subject-turn.ts';
import type { RunTrialInput } from './types.ts';

/** A role's record of a trial: the saved one, the intent that says it was sent, and the turn that makes it. */
type OnceTurnInput<A> = {
  readonly writeProgress: WriteProgress;
  readonly label: string;
  readonly role: Role;
  readonly record: OnceFile<A>;
  readonly intent: OnceFile<Intent>;
  readonly turn: Effect.Effect<A, EvalRunFailure>;
};

/**
 * Runs one trial: its subject's turn on a fresh mech, which receives the case's input alone, then, after an answer, a
 * fresh grader's turn against the case's expectations. A role the trial's files hold already is not run again, and one
 * whose intent they hold without its record is sent again under the intent's inbox item.
 */
export const runTrial = Effect.fn('runTrial')(function* ({
  call,
  access,
  suite,
  evalCase,
  trial,
  files,
  writeProgress,
}: RunTrialInput): Effect.fn.Return<void, EvalRunFailure> {
  const runInput = { call, access, suite, evalCase, trial, files, writeProgress };
  const label = `trial ${trial.id} (${evalCase.id} #${trial.repeat})`;
  const { subject, subjectIntent, grade, graderIntent } = files;
  const turn = subjectTurn(runInput);

  const { outcome } = yield* onceTurn({
    writeProgress,
    label,
    role: Role.Subject,
    record: subject,
    intent: subjectIntent,
    turn,
  });

  if (outcome.status === TurnStatus.Unanswered) {
    return;
  }

  const graded = graderTurn({ ...runInput, reply: outcome.reply });

  yield* onceTurn({ writeProgress, label, role: Role.Grader, record: grade, intent: graderIntent, turn: graded });
});

/**
 * A role's record: the one the trial saved, or the record of the turn it runs now, saved once. A saved intent without
 * its record sends the turn again under that intent's inbox item.
 */
const onceTurn = Effect.fn('onceTurn')(function* <A>({
  writeProgress,
  label,
  role,
  record,
  intent,
  turn,
}: OnceTurnInput<A>): Effect.fn.Return<A, EvalRunFailure> {
  const saved = yield* record.read();

  if (Option.isSome(saved)) {
    return saved.value;
  }

  const isResent = Option.isSome(yield* intent.read());

  const line: string = (() => {
    if (isResent) {
      return `${label}: sending its ${role}'s turn again under the inbox item it saved`;
    }

    return `${label}: running its ${role}'s turn`;
  })();

  writeProgress({ line });

  const ran = yield* turn;

  yield* record.create({ record: ran });

  return ran;
});

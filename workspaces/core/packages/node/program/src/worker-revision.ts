import { Duration, Effect } from 'effect';
import { finishedProcess } from './finished-process.ts';
import type { StepFailureClass } from './types.ts';

/** How long `git describe` may take to report the worker revision. */
const DESCRIBE_TIMEOUT = Duration.seconds(10);

/** The variables `git describe` runs with, and the step of the program and the failure it fails as. */
type WorkerRevisionInput<S, E> = {
  readonly environment: Readonly<Record<string, string>>;
  readonly step: S;
  readonly failure: StepFailureClass<S, E>;
};

/**
 * The revision of the working tree a program builds or deploys the Worker from, as `git describe` names it. It is a tag
 * for a tagged commit, marked dirty when the tree has uncommitted changes, and fails as the program's `failure` of
 * `step`.
 */
export const workerRevision = Effect.fn('workerRevision')(function* <S, E>({
  environment,
  step,
  failure: Failure,
}: WorkerRevisionInput<S, E>): Effect.fn.Return<string, E> {
  const described = yield* finishedProcess({
    command: 'git',
    args: ['-C', import.meta.dirname, 'describe', '--always', '--dirty', '--abbrev=12'],
    environment,
    timeout: DESCRIBE_TIMEOUT,
  }).pipe(Effect.mapError(({ reason }) => new Failure({ step, subjects: [], reason })));

  return described.stdout.trim();
});

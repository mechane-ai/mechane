import { finishedProcess, startProcess, StepSubject, SUCCESS_STATUS } from '@mechane/program';
import { Effect, Option } from 'effect';
import { DeployStep, GIT_NETWORK_TIMEOUT, WORKSPACE_FOLDER } from './constants.ts';
import { DeployFailed } from './errors.ts';
import type { GitInput } from './types.ts';

/** Runs a git command in the product workspace and answers with what it printed, failing unless it succeeds. */
export function runGit({ args, settings }: GitInput): Effect.Effect<string, DeployFailed> {
  const subjects = [StepSubject.cases.Command.make({ args })];

  return finishedProcess({
    command: 'git',
    args: ['-C', WORKSPACE_FOLDER, ...args],
    environment: { ...settings.inherited, ...settings.gitAgent },
    timeout: GIT_NETWORK_TIMEOUT,
  }).pipe(
    Effect.map(({ stdout }) => stdout),
    Effect.mapError(({ reason }) => new DeployFailed({ step: DeployStep.RunGit, subjects, reason })),
  );
}

/** Whether a git command that answers by its exit status, such as `merge-base --is-ancestor`, succeeds. */
export function gitSucceeds({ args, settings }: GitInput): Effect.Effect<boolean, DeployFailed> {
  const subjects = [StepSubject.cases.Command.make({ args })];

  const git = startProcess({
    command: 'git',
    args: ['-C', WORKSPACE_FOLDER, ...args],
    environment: { ...settings.inherited, ...settings.gitAgent },
    timeout: GIT_NETWORK_TIMEOUT,
  });

  return Effect.scoped(git.pipe(Effect.flatMap(({ exited }) => exited))).pipe(
    Effect.map(({ status }) => Option.contains(status, SUCCESS_STATUS)),
    Effect.mapError(({ reason }) => new DeployFailed({ step: DeployStep.RunGit, subjects, reason })),
  );
}

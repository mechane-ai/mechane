import { finishedProcess } from '@mechane/program';
import { Effect } from 'effect';
import { CHILD_TIMEOUT, WORKSPACE_FOLDER } from '../constants.ts';
import { InputUnreadable } from '../errors.ts';

type GitLinesInput = { readonly args: ReadonlyArray<string>; readonly inherited: Readonly<Record<string, string>> };

/** Runs one git command in the product workspace and returns each line it prints, paths relative to the workspace. */
export const gitLines = Effect.fn('gitLines')(function* ({
  args,
  inherited,
}: GitLinesInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const { stdout } = yield* finishedProcess({
    command: 'git',
    args: ['-C', WORKSPACE_FOLDER, ...args],
    environment: inherited,
    timeout: CHILD_TIMEOUT,
  }).pipe(Effect.mapError(({ command, reason }) => new InputUnreadable({ path: command, reason })));

  return stdout.split('\n').filter((line) => line !== '');
});

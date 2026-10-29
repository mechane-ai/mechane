import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import { PROGRAM } from '@mechane/commands';
import type { WorkspaceAccess } from '@mechane/eval';
import { writeDiagnostic } from '@mechane/program';
import type { Watch } from '@mechane/protocol';
import { WatchId, WorkspaceId } from '@mechane/records';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { watchLine } from './watch-line.ts';

/** Saves a watch and prints its stable ID before the request so a failed attempt can be retried. */
export const runWatchSet = Effect.fn('runWatchSet')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'watch set'>): Effect.fn.Return<CommandResult<'watch set'>, RunFailure> {
  const chosenId = Option.fromUndefinedOr(input.watchId);
  const createWatchId: () => WatchId = () => WatchId.make(crypto.randomUUID());
  const watchId = Option.getOrElse(chosenId, createWatchId);

  writeDiagnostic({ program: PROGRAM, line: `saving watch ${watchId}; retry or update with --watch-id ${watchId}` });

  const save: (access: WorkspaceAccess) => Effect.Effect<Watch, ClientFailure> = ({ token, workspaceId }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'setWatch', input: { ...input, watchId, workspaceId: workspace }, credential: token });
  };

  const watch = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use: save });

  return { lines: [watchLine({ watch })], result: watch };
});

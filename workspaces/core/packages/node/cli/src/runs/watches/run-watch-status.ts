import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { Watch, WatchStatus } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { watchLine } from './watch-line.ts';

type WatchStatusCommand = 'watch pause' | 'watch resume';

type RunWatchStatusInput<N extends WatchStatusCommand> = RunInput<N> & { readonly status: WatchStatus };

/** Pauses or resumes a watch without changing the mech or its Slack binding. */
export const runWatchStatus = Effect.fn('runWatchStatus')(function* <N extends WatchStatusCommand>({
  call,
  origin,
  input,
  credentials,
  status,
}: RunWatchStatusInput<N>): Effect.fn.Return<CommandResult<N>, RunFailure> {
  const change: (access: WorkspaceAccess) => Effect.Effect<Watch, ClientFailure> = ({ token, workspaceId }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'updateWatchStatus', input: { ...input, workspaceId: workspace, status }, credential: token });
  };

  const watch = yield* withWorkspace({ call, origin, credentials, use: change });

  return { lines: [watchLine({ watch })], result: watch };
});

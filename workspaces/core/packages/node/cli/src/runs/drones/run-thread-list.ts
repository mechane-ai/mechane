import type { CommandResult, PageCursor, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { ThreadList } from '@mechane/protocol';
import type { ThreadId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { readPages } from '../read-pages.ts';
import { threadLines } from './thread-lines.ts';

/** Lists the threads a mech opened, oldest first. */
export const runThreadList = Effect.fn('runThreadList')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'thread list'>): Effect.fn.Return<CommandResult<'thread list'>, RunFailure> {
  const threads: (access: WorkspaceAccess) => Effect.Effect<ThreadList, ClientFailure> = ({ token, workspaceId }) =>
    readPages({
      key: 'threads',
      read: ({ after }: PageCursor<ThreadId>) =>
        call({ name: 'listThreads', input: { ...input, workspaceId, after }, credential: token }),
    });

  const list = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use: threads });

  return { lines: list.threads.flatMap((thread) => threadLines({ thread })), result: list };
});

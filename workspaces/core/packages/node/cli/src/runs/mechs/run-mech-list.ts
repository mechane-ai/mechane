import type { CommandResult, PageCursor, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { MechList, MechSummary } from '@mechane/protocol';
import { Effect } from 'effect';
import { readPages } from '../read-pages.ts';
import { mechLine } from './mech-line.ts';
import { withWorkspace } from './with-workspace.ts';

/** Lists the mechs of the caller's workspace. */
export const runMechList = Effect.fn('runMechList')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'mech list'>): Effect.fn.Return<CommandResult<'mech list'>, RunFailure> {
  const mechs: (access: WorkspaceAccess) => Effect.Effect<MechList, ClientFailure> = ({ token, workspaceId }) =>
    readPages({
      key: 'mechs',
      read: ({ after }: PageCursor<MechSummary['id']>) =>
        call({ name: 'listMechs', input: { workspaceId, after }, credential: token }),
    });

  const list = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use: mechs });

  return { lines: list.mechs.map((mech) => mechLine({ mech })), result: list };
});

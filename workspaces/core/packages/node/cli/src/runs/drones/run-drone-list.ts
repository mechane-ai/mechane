import type { CommandResult, PageCursor, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { DroneList } from '@mechane/protocol';
import type { DroneId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { readPages } from '../read-pages.ts';
import { droneLine } from './drone-line.ts';

/** Lists the drones a mech started, oldest first. */
export const runDroneList = Effect.fn('runDroneList')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'drone list'>): Effect.fn.Return<CommandResult<'drone list'>, RunFailure> {
  const drones: (access: WorkspaceAccess) => Effect.Effect<DroneList, ClientFailure> = ({ token, workspaceId }) =>
    readPages({
      key: 'drones',
      read: ({ after }: PageCursor<DroneId>) =>
        call({ name: 'listDrones', input: { ...input, workspaceId, after }, credential: token }),
    });

  const list = yield* withWorkspace({ call, origin, credentials, use: drones });

  return { lines: list.drones.map((drone) => droneLine({ drone })), result: list };
});

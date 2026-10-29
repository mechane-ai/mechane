import { sandboxStub } from '@mechane/rpc';
import { Option } from 'effect';
import type { OpenedMech } from '../types.ts';

type CancelTurnCommandsInput = { readonly mech: OpenedMech };

/** Owed notes block later turns, so recovery can stop unfinished commands even after their tool invocation vanished. */
export async function cancelTurnCommands({ mech }: CancelTurnCommandsInput): Promise<void> {
  const current = await mech.store.atomic({ run: (tables) => tables.mech() });

  if (Option.isNone(current)) {
    return;
  }

  const { workspaceId, id } = current.value;
  const droneId = Option.none();
  const sandbox = sandboxStub({ bindings: mech.settings, workspaceId, mechId: id, droneId });

  await sandbox.cancelActiveExecutions();
}

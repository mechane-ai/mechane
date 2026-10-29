import { EVERY_WORKSPACE } from '@mechane/deployment';
import { SandboxRefusal } from '@mechane/harness-tools';
import type { Hands, HandsExecution } from '@mechane/harness-tools';
import type { MechRow, MechStore, MechTables, SessionIdInput } from '@mechane/mech-store';
import type { DroneId } from '@mechane/records';
import { sandboxStub, workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { untilAborted } from '@mechane/utilities';
import { Match, Option } from 'effect';
import { refusedOutcome } from './refused-outcome.ts';
import { settledExecution } from './settled-execution.ts';

/** What the mech's hands read its record from, and the settings that bind its sandboxes. */
type MechHandsInput = { readonly store: MechStore; readonly settings: ObjectSettings };

/** The tables a command's sandbox is read from, and the conversation the command comes from. */
type SandboxOwnerInput = { readonly store: MechTables; readonly role: HandsExecution['role'] };

/** The mech whose sandbox runs a command, and the drone whose own sandbox it is. */
type SandboxOwner = MechRow & {
  /** None for a command of the mech's own conversation, which runs in the mech's sandbox. */
  readonly droneId: Option.Option<DroneId>;
};

/**
 * The hands of a mech and its drones: each one's own sandbox, which runs each execution once under its id. A tool runs
 * only in a turn or a drone of a created mech, so the mech's record names the sandbox and a drone's conversation names
 * its drone. An unlisted or suspended workspace reaches no sandbox, and a full one none until a machine stops.
 */
export function mechHands({ store, settings }: MechHandsInput): Hands {
  const run: Hands['run'] = async (execution) => {
    const owner: (tables: MechTables) => SandboxOwner = (tables) =>
      sandboxOwner({ store: tables, role: execution.role });

    const { workspaceId, id, droneId } = await store.atomic({ run: owner });
    const isListed = settings.sandboxWorkspaces === EVERY_WORKSPACE || settings.sandboxWorkspaces.includes(workspaceId);
    const sandboxId = Option.getOrElse(droneId, () => id);
    const target = { workspaceId, mechId: id, sandboxId, machines: settings.workspaceMachines };
    const unaborted: () => AbortSignal = () => new AbortController().signal;
    const signal = Option.getOrElse(execution.signal, unaborted);

    if (!isListed || settings.suspendedWorkspaces.includes(workspaceId)) {
      return refusedOutcome({ target, reason: SandboxRefusal.NoSandbox });
    }

    return await settledExecution({
      sandbox: sandboxStub({ bindings: settings, workspaceId, mechId: id, droneId }),
      workspace: workspaceStub({ bindings: settings, workspaceId }),
      target,
      execution,
      signal,
      aborted: untilAborted({ signal }),
    });
  };

  return { run };
}

/** The mech whose sandbox runs a command, and, for a drone's conversation, the drone its session binds. */
function sandboxOwner({ store, role }: SandboxOwnerInput): SandboxOwner {
  const sessionDrone: (drone: SessionIdInput) => Option.Option<DroneId> = ({ sessionId }) =>
    Option.some(store.sessionDrone({ sessionId }).id);

  return {
    // A tool runs only in a turn or a drone of a created mech, so the mech's record is there.
    ...Option.getOrThrow(store.mech()),
    droneId: Match.valueTags(role, { Mech: () => Option.none(), Drone: sessionDrone }),
  };
}

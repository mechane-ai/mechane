import type { DispatchMeter } from '@mechane/harness';
import { directoryStub } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import { reserveDispatch } from './reserve-dispatch.ts';
import type { AllowanceInput, DispatchMeterInput } from './types.ts';

/**
 * The meter every dispatch of a mech and its drones passes before it leaves the object. It reserves the dispatch's
 * bound against its workspace's allowance and the mech's own cap, in the workspace's ledger of the day. The directory
 * is asked for the allowance once per instance of the object, and a suspended workspace has none, so its queued work
 * spends nothing.
 */
export function dispatchMeter({ store, settings, abortObject }: DispatchMeterInput): DispatchMeter {
  const allowances = new Map<string, number>();

  const allowance: (input: AllowanceInput) => Promise<number> = async ({ workspaceId }) => {
    if (settings.suspendedWorkspaces.includes(workspaceId)) {
      return 0;
    }

    const read = Option.fromNullishOr(allowances.get(workspaceId));

    if (Option.isSome(read)) {
      return read.value;
    }

    const answer = await directoryStub({ bindings: settings }).dailyAllowanceMicros({ workspaceId });
    const micros = Schema.decodeUnknownSync(Schema.Int)(answer);

    allowances.set(workspaceId, micros);

    return micros;
  };

  return { reserve: (dispatch) => reserveDispatch({ store, settings, abortObject, allowance, ...dispatch }) };
}

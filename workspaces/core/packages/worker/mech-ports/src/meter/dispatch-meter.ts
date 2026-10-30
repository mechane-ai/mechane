import type { DispatchMeter } from '@mechane/harness';
import { directoryStub } from '@mechane/rpc';
import { Schema } from 'effect';
import { reserveDispatch } from './reserve-dispatch.ts';
import type { AllowanceInput, DispatchMeterInput } from './types.ts';

/**
 * Every mech and drone dispatch reserves its bound against the workspace allowance and the mech's cap before it leaves
 * the object. The directory supplies the original allowance for workspaces without an explicit policy. The ledger
 * applies live policy atomically with each reservation, so suspension and reduced budgets govern queued work.
 */
export function dispatchMeter({ store, settings, abortObject }: DispatchMeterInput): DispatchMeter {
  const allowance: (input: AllowanceInput) => Promise<number> = async ({ workspaceId }) => {
    const answer = await directoryStub({ bindings: settings }).dailyAllowanceMicros({ workspaceId });
    const micros = Schema.decodeUnknownSync(Schema.Int)(answer);

    return micros;
  };

  return { reserve: (dispatch) => reserveDispatch({ store, settings, abortObject, allowance, ...dispatch }) };
}

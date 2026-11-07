import { ExecutionStatus } from '@mechane/sandbox-store';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { askGuest } from './ask-guest.ts';

type AdvanceToIdleExecutionInput = WorkspaceProviderStepInput & { readonly deadline: DateTime.Utc };

/** Reconciles a dispatched command before interactive startup or a file checkpoint; false asks the caller to retry. */
export async function advanceToIdleExecution({
  store,
  provider,
  workspace,
  deadline,
}: AdvanceToIdleExecutionInput): Promise<boolean> {
  const active = store.activeExecution();

  if (Option.isNone(active) || active.value.status !== ExecutionStatus.Dispatched) {
    return true;
  }

  const environment = Option.none();

  await askGuest({ store, provider, workspace, execution: active.value, deadline, environment });

  return false;
}

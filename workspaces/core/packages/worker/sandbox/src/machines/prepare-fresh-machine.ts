import { RecordId } from '@mechane/records';
import type { SourceFence } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import type { FreshSourceMachine, WorkspaceProviderStepInput } from '../types.ts';
import { awaitFreshMachine } from './await-fresh-machine.ts';

type PrepareFreshMachineInput = WorkspaceProviderStepInput & { readonly fence: SourceFence };

/** Credentials can reach only a restored generation created after the old guest's destruction was acknowledged. */
export async function prepareFreshMachine({
  store,
  provider,
  workspace,
  fence,
}: PrepareFreshMachineInput): Promise<Option.Option<FreshSourceMachine>> {
  const state = store.workspace();

  if (Option.isNone(workspace) || Option.isNone(state.head) || Option.isSome(state.recovery)) {
    return Option.none();
  }

  if (Option.isNone(fence.machineId)) {
    await replaceSourceMachine({ store, provider, workspace, fence });

    return Option.none();
  }

  const machineId = fence.machineId.value;

  if (!fence.isMachineStarted) {
    await provider.start({ machineId });
    store.saveSourceFence({ fence: { ...fence, isMachineStarted: true } });

    return Option.none();
  }

  return await awaitFreshMachine({ store, provider, workspace, machineId });
}

async function replaceSourceMachine({ store, provider, fence }: PrepareFreshMachineInput): Promise<void> {
  const previous = store.latestMachine();

  if (Option.isSome(previous)) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId: previous.value.id, now });
    await provider.stop({ machineId: previous.value.id });
  }

  const machineId = RecordId.make(crypto.randomUUID());
  const freshFence = { ...fence, machineId: Option.some(machineId), isMachineStarted: false };

  const replace: () => void = () => {
    const now = DateTime.nowUnsafe();

    store.openMachine({ machineId, now });
    store.saveSourceFence({ fence: freshFence });
  };

  store.atomic({ run: replace });
}

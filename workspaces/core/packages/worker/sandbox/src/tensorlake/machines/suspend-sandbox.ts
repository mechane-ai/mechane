import { Option } from 'effect';
import { TensorlakeStatus } from '../constants.ts';
import type { TensorlakeSettings } from '../types.ts';
import { changeSandbox } from './change-sandbox.ts';
import { TensorlakeAction } from './constants.ts';
import { readSandbox } from './read-sandbox.ts';

/** Sleeps the VM while retaining its disk, memory, and guest receipts. */
export async function suspendSandbox({ ...settings }: TensorlakeSettings): Promise<void> {
  const found = await readSandbox(settings);

  if (Option.isNone(found)) {
    return;
  }

  switch (found.value.status) {
    case TensorlakeStatus.Suspended:
    case TensorlakeStatus.Suspending:
    case TensorlakeStatus.Terminated:
      return;
    case TensorlakeStatus.Pending:
    case TensorlakeStatus.Running:
    case TensorlakeStatus.Snapshotting:
      await changeSandbox({ apiKey: settings.apiKey, sandboxId: found.value.id, action: TensorlakeAction.Suspend });
  }
}

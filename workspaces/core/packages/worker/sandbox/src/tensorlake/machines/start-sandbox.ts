import { Option } from 'effect';
import { TensorlakeStatus } from '../constants.ts';
import type { TensorlakeSettings } from '../types.ts';
import { changeSandbox } from './change-sandbox.ts';
import { TensorlakeAction } from './constants.ts';
import { createSandbox } from './create-sandbox.ts';
import { readSandbox } from './read-sandbox.ts';

/** Creates the first persistent VM or resumes it after idle suspension. */
export async function startSandbox({ ...settings }: TensorlakeSettings): Promise<void> {
  const found = await readSandbox(settings);

  if (Option.isNone(found)) {
    await createSandbox(settings);

    return;
  }

  if (found.value.status === TensorlakeStatus.Suspended) {
    await changeSandbox({ apiKey: settings.apiKey, sandboxId: found.value.id, action: TensorlakeAction.Resume });
  }
}

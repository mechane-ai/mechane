import { FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { checkpointInactiveEnvironment } from '../checkpoints/checkpoint-inactive-environment.ts';

type MachineLossInput = { readonly store: SandboxStore };

/** Ready-machine history requires a matching final Drain before ordinary allocation can resume. */
export function hasUncheckpointedMachineLoss({ store }: MachineLossInput): boolean {
  const live = store.liveMachine();

  if (Option.isSome(live)) {
    return false;
  }

  const inactive = checkpointInactiveEnvironment({ store });

  return FileCheckpointResult.guards.Failed(inactive);
}

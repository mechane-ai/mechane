import { SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';
import { hasUncheckpointedMachineLoss } from '../workspace/has-uncheckpointed-machine-loss.ts';
import type { ManagePortableInput } from './types.ts';

type PrepareMaintenanceInput = Pick<ManagePortableInput, 'store' | 'request'>;

export function prepareMaintenance({ store, request }: PrepareMaintenanceInput): SandboxPhase {
  const state = store.workspace();

  if (Option.isSome(state.recovery) || Option.isSome(state.checkpoint)) {
    throw new PortableMaintenanceRefused({
      reason: 'finish or recover the pending workspace checkpoint before maintenance',
    });
  }

  if (request.action === SandboxAction.Delete) {
    return SandboxPhase.Retire;
  }

  if (hasUncheckpointedMachineLoss({ store })) {
    if (Option.isNone(state.head)) {
      throw new PortableMaintenanceRefused({ reason: 'the lost environment has no committed generation to restore' });
    }

    return SandboxPhase.Create;
  }

  return SandboxPhase.Quiesce;
}

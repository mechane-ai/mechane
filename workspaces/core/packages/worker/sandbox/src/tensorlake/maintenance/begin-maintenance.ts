import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxRequest } from '@mechane/protocol';
import { Option } from 'effect';
import { inspectRemote } from '../machines/inspect-remote.ts';
import type { TensorlakeSettings } from '../types.ts';
import { fenceSandbox } from './fence-sandbox.ts';

type BeginMaintenanceInput = TensorlakeSettings & { readonly request: SandboxRequest };
type InitialPhaseInput = { readonly action: SandboxAction };

/** Saves intent and fences the guest before any maintenance effect starts. */
export async function beginMaintenance({ request, ...settings }: BeginMaintenanceInput): Promise<void> {
  if (Option.isNone(request.operationId) || request.action === SandboxAction.Cancel) {
    return;
  }

  const { store, apiKey } = settings;
  const bound = store.remoteSandbox();
  const identity = Option.getOrElse(bound, () => settings.name);
  const remote = await inspectRemote({ apiKey, name: identity });

  if (Option.isNone(remote) && request.action !== SandboxAction.Delete) {
    return;
  }

  if (Option.isSome(remote)) {
    store.bindRemoteSandbox({ sandboxId: remote.value.id });
  }

  fenceSandbox({ store });

  const sourceId = Option.match(remote, { onNone: () => identity, onSome: (found) => found.id });
  const phase = initialPhase({ action: request.action });

  const absent = Option.none();

  store.saveMaintenance({
    id: request.operationId.value,
    action: request.action,
    phase,
    image: settings.image,
    sourceId,
    targetId: absent,
    archive: absent,
    part: 0,
  });
}

function initialPhase({ action }: InitialPhaseInput): SandboxPhase {
  if (action === SandboxAction.Delete) {
    return SandboxPhase.Retire;
  }

  return SandboxPhase.Quiesce;
}

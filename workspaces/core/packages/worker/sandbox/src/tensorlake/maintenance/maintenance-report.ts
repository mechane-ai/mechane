import { SandboxPhase } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Option } from 'effect';
import { inspectRemote } from '../machines/inspect-remote.ts';
import type { TensorlakeSettings } from '../types.ts';

/** Reads provider state without waking it; the binding remains observable when its VM is missing. */
export async function maintenanceReport({ apiKey, name, image, store }: TensorlakeSettings): Promise<SandboxReport> {
  const bound = store.remoteSandbox();
  const identity = Option.getOrElse(bound, () => name);
  const found = await inspectRemote({ apiKey, name: identity });
  const job = store.maintenance();
  const foundId = Option.map(found, (remote) => remote.id);

  return {
    provider: 'tensorlake',
    sandboxId: Option.orElse(bound, () => foundId),
    status: Option.match(found, { onNone: () => 'missing', onSome: (remote) => remote.status }),
    image: Option.map(found, (remote) => remote.image),
    desiredImage: image,
    operationId: Option.map(job, (current) => current.id),
    action: Option.map(job, (current) => current.action),
    phase: Option.match(job, { onNone: () => SandboxPhase.Idle, onSome: (current) => current.phase }),
    archive: Option.flatMap(job, (current) => current.archive),
    part: Option.match(job, { onNone: () => 0, onSome: (current) => current.part }),
    base64: Option.none(),
  };
}

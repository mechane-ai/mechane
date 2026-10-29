import { SandboxPhase } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode, RemoteSandboxId } from '@mechane/records';
import { Option, Schema } from 'effect';
import { TENSORLAKE_ORIGIN, TensorlakePath, TensorlakeStatus } from '../../constants.ts';
import { inspectRemote } from '../../machines/inspect-remote.ts';
import { sandboxStart } from '../../machines/sandbox-start.ts';
import { tensorlakeAnswer } from '../../tensorlake-answer.ts';
import { tensorlakeRequest } from '../../tensorlake-request.ts';
import type { MaintenanceInput } from '../types.ts';

const Created = Schema.Struct({ sandbox_id: RemoteSandboxId });

/** The operation's unique name makes a lost create response recoverable without changing the current binding. */
export async function createReplacement({ job, ...settings }: MaintenanceInput): Promise<void> {
  const { apiKey, store } = settings;
  const name = `foundry-upgrade-${job.id}`;
  const identity = Option.getOrElse(job.targetId, () => name);
  const found = await inspectRemote({ apiKey, name: identity });

  if (Option.isSome(found)) {
    const targetId = Option.some(found.value.id);

    if (found.value.status === TensorlakeStatus.Terminated) {
      store.saveMaintenance({ ...job, targetId, phase: SandboxPhase.Failed });

      return;
    }

    store.saveMaintenance({ ...job, targetId, phase: SandboxPhase.Copy });

    return;
  }

  const url = new URL(TensorlakePath.Sandboxes, TENSORLAKE_ORIGIN);
  const body = sandboxStart({ ...settings, name, image: job.image });
  const response = await tensorlakeRequest({ apiKey, url, init: { method: HttpMethod.Post, body } });

  if (response.status === HttpStatusCode.Conflict) {
    return;
  }

  const created = await tensorlakeAnswer({ response, schema: Created });

  const targetId = Option.some(created.sandbox_id);

  store.saveMaintenance({ ...job, targetId });
}

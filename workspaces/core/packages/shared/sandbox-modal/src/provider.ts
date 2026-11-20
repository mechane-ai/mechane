import { HttpMethod, HttpStatusCode } from '@mechane/records';
import {
  createBearerSandboxClient,
  requireSandboxOk,
  SandboxLifecycleState,
  sandboxWorkerEnvironment,
} from '@mechane/sandbox-provider';
import type {
  SandboxHandle,
  SandboxIdentifierInput,
  SandboxLeaseSpecification,
  SandboxProviderAdapter,
  SandboxSnapshot,
  SandboxStopInput,
  SandboxStopResult,
} from '@mechane/sandbox-provider';
import { Schema } from 'effect';

const MODAL_ENVIRONMENT_FIELD = 'env';

const ModalSandboxResponse = Schema.Struct({
  sandbox_id: Schema.NonEmptyString,
  status: SandboxLifecycleState,
  sandbox_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
  reason: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

const ModalSnapshotResponse = Schema.Struct({ snapshot_id: Schema.NonEmptyString, created_at: Schema.NonEmptyString });

const ModalStopResponse = Schema.Struct({ snapshot_id: Schema.NullOr(Schema.String) });

type ModalSandboxConfiguration = {
  readonly baseUrl: string;
  readonly bearerToken: string;
  readonly appName?: string | undefined;
  readonly transport?: typeof fetch | undefined;
};

/** Creates a Worker-compatible HTTPS `SandboxProviderAdapter` backed by Modal Sandboxes. */
export function createModalSandboxProvider({
  baseUrl,
  bearerToken,
  appName = 'mechane-sandboxes',
  transport,
}: ModalSandboxConfiguration): SandboxProviderAdapter {
  const request = createBearerSandboxClient({ baseUrl, bearerToken, transport });

  function decodeHandle(raw: unknown): SandboxHandle {
    const parsed = Schema.decodeUnknownSync(ModalSandboxResponse)(raw);

    return {
      provider: 'modal',
      sandboxId: parsed.sandbox_id,
      status: parsed.status,
      sandboxUrl: parsed.sandbox_url ?? null,
      reason: parsed.reason ?? null,
    };
  }

  async function startOrResume(specification: SandboxLeaseSpecification): Promise<SandboxHandle> {
    const payload: Record<string, unknown> = {
      app_name: appName,
      session_id: specification.sessionId,
      image: specification.image,
      existing_sandbox_id: specification.existingSandboxId,
      snapshot_id: specification.snapshotId,
      cpu_cores: specification.cpuCores ?? null,
      memory_mb: specification.memoryMegabytes ?? null,
      timeout_seconds: specification.timeoutSeconds ?? null,
      [MODAL_ENVIRONMENT_FIELD]: sandboxWorkerEnvironment(specification),
    };

    const response = await request(HttpMethod.Post, '/v1/sandboxes/start-or-resume', payload);

    return decodeHandle(requireSandboxOk('modal', response, 'startOrResume'));
  }

  async function snapshot({ sandboxId }: SandboxIdentifierInput): Promise<SandboxSnapshot> {
    const response = await request(HttpMethod.Post, `/v1/sandboxes/${encodeURIComponent(sandboxId)}/snapshot`);

    const parsed = Schema.decodeUnknownSync(ModalSnapshotResponse)(requireSandboxOk('modal', response, 'snapshot'));

    return { snapshotId: parsed.snapshot_id, createdAt: parsed.created_at };
  }

  async function status({ sandboxId }: SandboxIdentifierInput): Promise<SandboxHandle> {
    const response = await request(HttpMethod.Get, `/v1/sandboxes/${encodeURIComponent(sandboxId)}`);

    if (response.status === HttpStatusCode.NotFound) {
      return { provider: 'modal', sandboxId, status: 'stopped' };
    }

    return decodeHandle(requireSandboxOk('modal', response, 'status'));
  }

  async function stop({ sandboxId, shouldSnapshot = true }: SandboxStopInput): Promise<SandboxStopResult> {
    const response = await request(HttpMethod.Post, `/v1/sandboxes/${encodeURIComponent(sandboxId)}/stop`, {
      should_snapshot: shouldSnapshot,
    });

    if (response.status === HttpStatusCode.NotFound) {
      return { snapshotId: null };
    }

    const parsed = Schema.decodeUnknownSync(ModalStopResponse)(requireSandboxOk('modal', response, 'stop'));

    return { snapshotId: parsed.snapshot_id };
  }

  async function destroy({ sandboxId }: SandboxIdentifierInput): Promise<void> {
    const response = await request(HttpMethod.Delete, `/v1/sandboxes/${encodeURIComponent(sandboxId)}`);

    if (response.status !== HttpStatusCode.NotFound) {
      requireSandboxOk('modal', response, 'destroy');
    }
  }

  return { kind: 'modal', startOrResume, snapshot, status, stop, destroy };
}

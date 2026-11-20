import { HttpMethod, HttpStatusCode } from '@mechane/records';
import {
  captureOptionalSnapshot,
  createBearerSandboxClient,
  requireSandboxOk,
  SandboxProviderError,
  sandboxWorkerEnvironment,
} from '@mechane/sandbox-provider';
import type {
  SandboxHandle,
  SandboxIdentifierInput,
  SandboxLeaseSpecification,
  SandboxLifecycleState,
  SandboxProviderAdapter,
  SandboxSnapshot,
  SandboxStopInput,
  SandboxStopResult,
} from '@mechane/sandbox-provider';
import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Schema } from 'effect';

const DEFAULT_BASE_URL = 'https://api.tensorlake.ai';
const TENSORLAKE_ENVIRONMENT_FIELD = 'env';
const TENSORLAKE_AUTO_RESUME_FIELD = 'auto_resume';
const SANDBOX_NAME_MAX_LENGTH = 64;
const SNAPSHOT_POLL_INTERVAL = Duration.millis(500);
const SNAPSHOT_MAX_POLLS = 60;
const READY_SNAPSHOT_STATUSES: ReadonlySet<string> = new Set(['completed', 'local_ready']);
const FAILED_SNAPSHOT_STATUSES: ReadonlySet<string> = new Set(['failed', 'error']);
const RECREATABLE_RESUME_STATUSES: ReadonlySet<number> = new Set([HttpStatusCode.NotFound, HttpStatusCode.Conflict]);

const TensorlakeSandboxResponse = Schema.Struct({
  sandbox_id: Schema.NonEmptyString,
  status: Schema.String,
  sandbox_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
  reason: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

const TensorlakeSnapshotResponse = Schema.Struct({
  snapshot_id: Schema.NonEmptyString,
  status: Schema.optionalKey(Schema.String),
  created_at: Schema.optionalKey(Schema.String),
});

type TensorlakeSandboxConfiguration = {
  readonly apiKey: string;
  readonly baseUrl?: string | undefined;
  readonly transport?: typeof fetch | undefined;
};

function normalizeState(raw: string): SandboxLifecycleState {
  switch (raw) {
    case 'pending':
    case 'creating':
    case 'starting':
      return 'starting';
    case 'running':
    case 'ready':
      return 'running';
    case 'suspended':
    case 'suspending':
      return 'suspended';
    case 'terminated':
    case 'stopped':
      return 'stopped';
    default:
      return 'failed';
  }
}

function sandboxNameForSession(sessionId: string): string {
  return `mechane-${sessionId.replaceAll(/[^A-Za-z0-9_-]/gu, '-').slice(0, SANDBOX_NAME_MAX_LENGTH)}`;
}

function currentIsoTimestamp(): string {
  return DateTime.formatIso(DateTime.nowUnsafe());
}

/** Creates a Worker-compatible HTTPS `SandboxProviderAdapter` backed by Tensorlake Sandboxes. */
export function createTensorlakeSandboxProvider({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  transport,
}: TensorlakeSandboxConfiguration): SandboxProviderAdapter {
  const request = createBearerSandboxClient({ baseUrl, bearerToken: apiKey, transport });

  function decodeHandle(raw: unknown): SandboxHandle {
    const parsed = Schema.decodeUnknownSync(TensorlakeSandboxResponse)(raw);

    return {
      provider: 'tensorlake',
      sandboxId: parsed.sandbox_id,
      status: normalizeState(parsed.status),
      sandboxUrl: parsed.sandbox_url ?? null,
      reason: parsed.reason ?? null,
    };
  }

  async function startOrResume(specification: SandboxLeaseSpecification): Promise<SandboxHandle> {
    if (specification.existingSandboxId !== null) {
      const resumed = await request(
        HttpMethod.Post,
        `/sandboxes/${encodeURIComponent(specification.existingSandboxId)}/resume`,
      );

      if (resumed.isOk) {
        const hasSandboxId = resumed.body !== null && typeof resumed.body === 'object' && 'sandbox_id' in resumed.body;

        if (hasSandboxId) {
          return decodeHandle(resumed.body);
        }

        return { provider: 'tensorlake', sandboxId: specification.existingSandboxId, status: 'running' };
      }

      if (!RECREATABLE_RESUME_STATUSES.has(resumed.status)) {
        requireSandboxOk('tensorlake', resumed, 'resume');
      }
    }

    const payload: Record<string, unknown> = {
      name: sandboxNameForSession(specification.sessionId),
      image: specification.image,
      [TENSORLAKE_ENVIRONMENT_FIELD]: sandboxWorkerEnvironment(specification),
      [TENSORLAKE_AUTO_RESUME_FIELD]: false,
    };

    if (specification.snapshotId !== null) {
      payload['snapshot_id'] = specification.snapshotId;
    }

    if (specification.timeoutSeconds !== undefined) {
      payload['timeout_secs'] = specification.timeoutSeconds;
    }

    if (specification.cpuCores !== undefined || specification.memoryMegabytes !== undefined) {
      payload['resources'] = {
        ...(specification.cpuCores !== undefined && { cpus: specification.cpuCores }),
        ...(specification.memoryMegabytes !== undefined && { memory_mb: specification.memoryMegabytes }),
      };
    }

    const created = await request(HttpMethod.Post, '/sandboxes', payload);

    return decodeHandle(requireSandboxOk('tensorlake', created, 'create'));
  }

  async function snapshot({ sandboxId }: SandboxIdentifierInput): Promise<SandboxSnapshot> {
    const started = await request(HttpMethod.Post, `/sandboxes/${encodeURIComponent(sandboxId)}/snapshot`);

    const initial = Schema.decodeUnknownSync(TensorlakeSnapshotResponse)(
      requireSandboxOk('tensorlake', started, 'snapshot'),
    );

    if (initial.status !== undefined && READY_SNAPSHOT_STATUSES.has(initial.status)) {
      return { snapshotId: initial.snapshot_id, createdAt: initial.created_at ?? currentIsoTimestamp() };
    }

    for (let poll = 0; poll < SNAPSHOT_MAX_POLLS; poll += 1) {
      await waitFor({ span: SNAPSHOT_POLL_INTERVAL });

      const checked = await request(HttpMethod.Get, `/snapshots/${encodeURIComponent(initial.snapshot_id)}`);

      const current = Schema.decodeUnknownSync(TensorlakeSnapshotResponse)(
        requireSandboxOk('tensorlake', checked, 'snapshot status'),
      );

      if (current.status !== undefined && READY_SNAPSHOT_STATUSES.has(current.status)) {
        return { snapshotId: current.snapshot_id, createdAt: current.created_at ?? currentIsoTimestamp() };
      }

      if (current.status !== undefined && FAILED_SNAPSHOT_STATUSES.has(current.status)) {
        throw new SandboxProviderError({
          provider: 'tensorlake',
          status: HttpStatusCode.InternalServerError,
          isRetryable: false,
          reason: `Tensorlake snapshot ${initial.snapshot_id} failed`,
        });
      }
    }

    throw new SandboxProviderError({
      provider: 'tensorlake',
      status: HttpStatusCode.Unavailable,
      isRetryable: true,
      reason: `Tensorlake snapshot ${initial.snapshot_id} did not settle before timeout`,
    });
  }

  async function status({ sandboxId }: SandboxIdentifierInput): Promise<SandboxHandle> {
    const response = await request(HttpMethod.Get, `/sandboxes/${encodeURIComponent(sandboxId)}`);

    if (response.status === HttpStatusCode.NotFound) {
      return { provider: 'tensorlake', sandboxId, status: 'stopped' };
    }

    return decodeHandle(requireSandboxOk('tensorlake', response, 'status'));
  }

  async function stop({ sandboxId, shouldSnapshot = true }: SandboxStopInput): Promise<SandboxStopResult> {
    const snapshotId = await captureOptionalSnapshot({ sandboxId, shouldSnapshot, snapshot });
    const suspended = await request(HttpMethod.Post, `/sandboxes/${encodeURIComponent(sandboxId)}/suspend`);

    if (suspended.status !== HttpStatusCode.NotFound) {
      requireSandboxOk('tensorlake', suspended, 'suspend');
    }

    return { snapshotId };
  }

  async function destroy({ sandboxId }: SandboxIdentifierInput): Promise<void> {
    const deleted = await request(HttpMethod.Delete, `/sandboxes/${encodeURIComponent(sandboxId)}`);

    if (deleted.status !== HttpStatusCode.NotFound) {
      requireSandboxOk('tensorlake', deleted, 'destroy');
    }
  }

  return { kind: 'tensorlake', startOrResume, snapshot, status, stop, destroy };
}

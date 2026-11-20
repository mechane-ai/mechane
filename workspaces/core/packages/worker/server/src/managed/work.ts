import { ManagedStoreError } from '@mechane/control-store';
import type { ManagedScope } from '@mechane/control-store';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { setTimeout as delay } from 'node:timers/promises';
import { ManagedHttpError } from './http-error.ts';
import type { ManagedRequest } from './types.ts';
import { requireWorkerWorkspace, workerBearer } from './work-auth.ts';
import { reconcileLostWork } from './work-recovery.ts';

type WorkRequest = Omit<ManagedRequest, 'scope'> & {
  readonly authenticate: (request: Request, peerAddress: string | null) => Promise<ManagedScope>;
  readonly peerAddress: string | null;
  readonly origin: string;
};

const WorkMetadata = Schema.Record(Schema.String, Schema.NullOr(Schema.String));
const BLOCK_MILLISECONDS_MAX = 999;
const POLL_INTERVAL_MIN_MS = 100;
const POLL_INTERVAL_MAX_MS = 400;
const POLL_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECLAIM_MS = 5000;
const DEFAULT_TTL_SECONDS = 60;
const TTL_SECONDS_MAX = 300;
const DEFAULT_PAGE_ROWS = 20;
const WORKER_ID_LENGTH_MAX = 256;
const PAGE_MAX = 1000;

type WorkResponse = { readonly workspaceId: string; readonly value: unknown };

type WorkerHeartbeat = Awaited<ReturnType<WorkRequest['store']['managed']['worker']['heartbeat']>>;

function heartbeatResponse(result: WorkerHeartbeat) {
  switch (result.kind) {
    case 'heartbeat':
      return result.value;
    case 'precondition':
      throw new ManagedStoreError(HttpStatusCode.PreconditionFailed, 'Heartbeat has changed', result.details);
    case 'unavailable':
      throw new ManagedHttpError(HttpStatusCode.Conflict, 'Work has no active lease');
    case 'missing':
      return workNotFound();
  }
}

function integer(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid numeric work parameter');
  }

  if (value < 1 || value > maximum) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid numeric work parameter');
  }

  return value;
}

function clampedTtl(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_TTL_SECONDS;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid numeric work parameter');
  }

  return Math.min(value, TTL_SECONDS_MAX);
}

function workNotFound(): never {
  throw new ManagedHttpError(HttpStatusCode.NotFound, 'Work item not found');
}

function invalidCredential(): never {
  throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Invalid work credential');
}

async function userWork(input: WorkRequest, environmentId: string, workId: string): Promise<WorkResponse> {
  const scope = await input.authenticate(input.request, input.peerAddress);
  const target = { scope, environmentId, workId };
  const worker = input.store.managed.worker;

  if (input.request.method === HttpMethod.Get) {
    return { workspaceId: scope.workspaceId, value: (await worker.get(target)) ?? workNotFound() };
  }

  try {
    const metadata = Schema.decodeUnknownSync(WorkMetadata)(input.body['metadata']);

    return { workspaceId: scope.workspaceId, value: (await worker.update({ ...target, metadata })) ?? workNotFound() };
  } catch (error) {
    if (Schema.isSchemaError(error)) {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid work metadata');
    }

    throw error;
  }
}

async function pollWork(input: WorkRequest, workspaceId: string, environmentId: string) {
  const workerId = input.request.headers.get('Anthropic-Worker-ID');
  const worker = input.store.managed.worker;

  if (workerId !== null) {
    if (workerId.length === 0 || workerId.length > WORKER_ID_LENGTH_MAX) {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid worker ID');
    }

    await worker.observePoll({ workspaceId, environmentId, workerId });
  }

  const reclaimAfterMilliseconds = integer(
    input.query['reclaim_older_than_ms'],
    DEFAULT_RECLAIM_MS,
    Number.MAX_SAFE_INTEGER,
  );

  const blockMs = integer(input.query['block_ms'], 0, BLOCK_MILLISECONDS_MAX);
  const pollInput = { workspaceId, environmentId, reclaimAfterMilliseconds, origin: input.origin };

  try {
    await reconcileLostWork({ sessions: input.sessions, store: input.store, workspaceId, environmentId });
  } catch (failure) {
    const available = await worker.poll(pollInput);

    if (available !== null) {
      return available;
    }

    throw failure;
  }

  const deadlineMs = Date.now() + blockMs;
  let intervalMs = POLL_INTERVAL_MIN_MS;

  do {
    input.request.signal.throwIfAborted();

    const work = await worker.poll(pollInput);

    if (work !== null) {
      return work;
    }

    const remaining = deadlineMs - Date.now();

    if (remaining <= 0) {
      return null;
    }

    const waitMs = Math.min(intervalMs, remaining);

    await delay(waitMs, undefined, { signal: input.request.signal });

    intervalMs = Math.min(POLL_INTERVAL_MAX_MS, intervalMs * POLL_BACKOFF_MULTIPLIER);
  } while (Date.now() < deadlineMs);

  return null;
}

async function tryWorkerTarget(input: WorkRequest, environmentId: string, workId: string) {
  const worker = input.store.managed.worker;
  const token = workerBearer(input.request);

  if (token.startsWith('sk-ant-req-')) {
    const claim = await worker.tokenScope({ token, purpose: 'lifecycle' });

    if (claim === null || claim.environmentId !== environmentId || claim.workId !== workId) {
      invalidCredential();
    }

    requireWorkerWorkspace(input.request, claim.workspaceId);

    return { workspaceId: claim.workspaceId, environmentId, workId, tokenHash: worker.digestWorkToken(token) };
  }

  if (token.length === 0) {
    return null;
  }

  const key = await worker.environments.resolveKey({ environmentId, token });

  if (key === null) {
    return null;
  }

  requireWorkerWorkspace(input.request, key.workspaceId);

  return { workspaceId: key.workspaceId, environmentId, workId, tokenHash: null };
}

async function resolveStopTarget(input: WorkRequest, environmentId: string, workId: string) {
  const workerTarget = await tryWorkerTarget(input, environmentId, workId);

  if (workerTarget !== null) {
    return workerTarget;
  }

  const scope = await input.authenticate(input.request, input.peerAddress);
  const visible = await input.store.managed.worker.get({ scope, environmentId, workId });

  if (visible === null) {
    return workNotFound();
  }

  return { workspaceId: scope.workspaceId, environmentId, workId, tokenHash: null };
}

async function workTarget(input: WorkRequest, environmentId: string, workId: string) {
  const target = await tryWorkerTarget(input, environmentId, workId);

  if (target === null) {
    invalidCredential();
  }

  return target;
}

export async function handleManagedWorkOperation(input: WorkRequest): Promise<WorkResponse> {
  const environmentId = input.params['environment_id'];
  const workId = input.params['work_id'] ?? '';

  if (environmentId === undefined) {
    return workNotFound();
  }

  const worker = input.store.managed.worker;

  switch (input.operation) {
    case 'beta_get_work_v1_environments__environment_id__work__work_id__get':
    case 'beta_update_work_v1_environments__environment_id__work__work_id__post':
      return await userWork(input, environmentId, workId);
    case 'beta_get_environment_stats_v1_environments__environment_id__work_stats_get': {
      const token = workerBearer(input.request);
      const key = await worker.environments.resolveKey({ environmentId, token });

      if (key !== null) {
        requireWorkerWorkspace(input.request, key.workspaceId);

        const stats = await worker.stats({ workspaceId: key.workspaceId, environmentId });

        return { workspaceId: key.workspaceId, value: stats };
      }

      const scope = await input.authenticate(input.request, input.peerAddress);
      const environment = await worker.environments.get({ scope, id: environmentId });

      if (environment === null) {
        return workNotFound();
      }

      const stats = await worker.stats({ workspaceId: scope.workspaceId, environmentId });

      return { workspaceId: scope.workspaceId, value: stats };
    }
    case 'beta_stop_work_v1_environments__environment_id__work__work_id__stop_post': {
      const target = await resolveStopTarget(input, environmentId, workId);
      const stopped = await worker.stop({ ...target, shouldForce: input.body['force'] === true });

      if (stopped === null) {
        return workNotFound();
      }

      if (stopped.state === 'stopped') {
        input.wakeInstalledSession({ workspaceId: target.workspaceId, environmentId, sessionId: stopped.data.id });
      }

      return { workspaceId: target.workspaceId, value: stopped };
    }
    default:
      break;
  }

  const target = await workTarget(input, environmentId, workId);

  switch (input.operation) {
    case 'beta_poll_work_v1_environments__environment_id__work_poll_get': {
      const polled = await pollWork(input, target.workspaceId, environmentId);

      return { workspaceId: target.workspaceId, value: polled };
    }
    case 'beta_list_work_v1_environments__environment_id__work_get': {
      const maxRows = integer(input.query['limit'], DEFAULT_PAGE_ROWS, PAGE_MAX);
      const page = input.query['page'];

      if (typeof page === 'string') {
        return { workspaceId: target.workspaceId, value: await worker.list({ ...target, maxRows, page }) };
      }

      return { workspaceId: target.workspaceId, value: await worker.list({ ...target, maxRows, page: null }) };
    }
    case 'beta_acknowledge_work_v1_environments__environment_id__work__work_id__ack_post':
      return { workspaceId: target.workspaceId, value: (await worker.acknowledge(target)) ?? workNotFound() };
    case 'beta_record_heartbeat_v1_environments__environment_id__work__work_id__heartbeat_post': {
      const ttlSeconds = clampedTtl(input.query['desired_ttl_seconds']);
      const expected = input.query['expected_last_heartbeat'];

      if (expected !== undefined && typeof expected !== 'string') {
        throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid expected heartbeat');
      }

      const result = await worker.heartbeat({ ...target, ttlSeconds, expected: expected ?? null });

      return { workspaceId: target.workspaceId, value: heartbeatResponse(result) };
    }
    default:
      return workNotFound();
  }
}

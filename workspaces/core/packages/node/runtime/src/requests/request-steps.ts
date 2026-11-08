import { HttpMethod } from '@mechane/records';
import { FatalError } from 'workflow';
import { z } from 'zod';
import { ExternalStatus } from './request-schema.ts';
import type { AccessSubmission, PreparedRequest, RequestPreparation, TokenSubmission } from './request-schema.ts';
import type { LoadedService } from './service.ts';

const VendStatus = z.object({
  id: z.uuid(),
  status: z.enum([
    'awaiting_approval',
    'approved',
    'denied',
    'expired',
    'cancelled',
    'minting',
    'issued',
    'failed',
    'deleted',
  ]),
  approval: z.object({ id: z.uuid(), url: z.url(), status: z.string() }).nullable(),
  error: z.string().nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
});

export async function prepareRequest({
  context,
  kind,
  requestId: existingRequestId,
}: RequestPreparation): Promise<PreparedRequest> {
  'use step';

  const { loadRequestService, verifyServiceIdentity } = await import('./service.ts');
  const { withRuntimeStore } = await import('../store/runtime-store.ts');
  const { executionId } = await import('../execution-id.ts');
  const service = await loadRequestService({ context, kind });

  await verifyServiceIdentity(service);

  const requestCallId = [kind, context.toolCallId].join(':');
  const requestId = existingRequestId ?? (await executionId({ runId: context.runId, toolCallId: requestCallId }));
  const hookToken = `mechane-request:${service.configuration.serviceId}:${kind}:${requestId}`;

  const wait = await withRuntimeStore(
    async (store) =>
      await store.registerRequestWait({
        serviceId: service.configuration.serviceId,
        requestId,
        kind,
        runId: context.runId,
        hookToken,
        serviceIdentity: service.identity,
      }),
  );

  const identity = {
    workspaceId: context.workspaceId,
    mechId: context.mechId,
    sessionId: context.sessionId,
    runId: context.runId,
  };

  return { context: identity, wait };
}

export async function submitAccess({ context, wait, input }: AccessSubmission): Promise<ExternalStatus> {
  'use step';

  const { loadRequestService, requestUrl, sendNexusRequest } = await import('./service.ts');
  const service = await loadRequestService({ context, kind: wait.kind, expectedIdentity: wait.serviceIdentity });
  const task = trustedTask(service);
  const body = { id: wait.requestId, ...input, task };
  const url = requestUrl(service.configuration, 'access');
  const response = await sendNexusRequest({ service, url, method: HttpMethod.Post, body });

  if (!response.isSuccessful) {
    return refused(wait.requestId, 'access', response.status);
  }

  return validateStatus(response.payload, wait.requestId, 'access');
}

export async function submitToken({ context, wait, input }: TokenSubmission): Promise<ExternalStatus> {
  'use step';

  const { loadRequestService, vendUrl, sendNexusRequest } = await import('./service.ts');
  const service = await loadRequestService({ context, kind: wait.kind, expectedIdentity: wait.serviceIdentity });
  const url = vendUrl(service.configuration, input.connectionId);

  const body = {
    id: wait.requestId,
    reason: input.reason,
    limitUsd: input.limitUsd,
    ttlMinutes: input.ttlMinutes,
    delivery: 'provider',
  };

  const response = await sendNexusRequest({ service, url, method: HttpMethod.Post, body });

  if (!response.isSuccessful) {
    return refused(wait.requestId, 'vend', response.status);
  }

  const decoded = VendStatus.safeParse(response.payload);

  if (!decoded.success || decoded.data.id !== wait.requestId) {
    throw new FatalError('Nexus returned an invalid token request.');
  }

  return {
    id: decoded.data.id,
    kind: 'vend',
    status: vendState(decoded.data.status),
    approval: decoded.data.approval,
    error: decoded.data.error,
    expiresAt: decoded.data.expiresAt,
  };
}

export async function readRequestStatus({ context, wait }: PreparedRequest): Promise<ExternalStatus> {
  'use step';

  const { loadRequestService, requestUrl, sendNexusRequest } = await import('./service.ts');
  const service = await loadRequestService({ context, kind: wait.kind, expectedIdentity: wait.serviceIdentity });
  const url = requestUrl(service.configuration, wait.kind, wait.requestId);
  const response = await sendNexusRequest({ service, url, method: HttpMethod.Get });

  if (!response.isSuccessful) {
    return refused(wait.requestId, wait.kind, response.status);
  }

  return validateStatus(response.payload, wait.requestId, wait.kind);
}

export async function markRequestWaiting({ context }: PreparedRequest): Promise<void> {
  'use step';

  const { withRuntimeStore } = await import('../store/runtime-store.ts');

  await withRuntimeStore(async (store) => await store.markRunWaiting({ runId: context.runId }));
}

export async function finishRequestWait({ context, wait }: PreparedRequest): Promise<void> {
  'use step';

  const { withRuntimeStore } = await import('../store/runtime-store.ts');

  await withRuntimeStore(
    async (store) =>
      await store.runInTransaction(async (transaction) => {
        await transaction.markRunRunning({ runId: context.runId });
        await transaction.closeRequestWait({
          serviceId: wait.serviceId,
          requestId: wait.requestId,
          kind: wait.kind,
          runId: context.runId,
        });
      }),
  );
}

export async function recordedDecision({ wait }: PreparedRequest): Promise<boolean> {
  'use step';

  const { withRuntimeStore } = await import('../store/runtime-store.ts');

  const recorded = await withRuntimeStore(
    async (store) =>
      await store.getRequestWait({ serviceId: wait.serviceId, requestId: wait.requestId, kind: wait.kind }),
  );

  return recorded !== null && recorded.resolution !== null;
}

function validateStatus(value: unknown, requestId: string, kind: ExternalStatus['kind']): ExternalStatus {
  const decoded = ExternalStatus.safeParse(value);

  if (!decoded.success || decoded.data.id !== requestId || decoded.data.kind !== kind) {
    throw new FatalError('Nexus returned an invalid request status.');
  }

  return decoded.data;
}

function refused(id: string, kind: ExternalStatus['kind'], status: number): ExternalStatus {
  return { id, kind, status: 'failed', approval: null, error: `Nexus refused this operation (${status}).` };
}

function trustedTask(service: LoadedService) {
  const task = { runtime: 'mechane', instanceId: service.run.mechId, workId: service.run.id };

  if (service.run.origin.kind !== 'slack') {
    return task;
  }

  const origin = service.run.origin;

  return {
    ...task,
    slack: {
      workspaceId: origin.teamId,
      userId: origin.userId,
      channelId: origin.channelId,
      threadTs: origin.threadId,
      messageTs: origin.messageId,
    },
  };
}

function vendState(status: z.infer<typeof VendStatus>['status']): ExternalStatus['status'] {
  switch (status) {
    case 'awaiting_approval':
    case 'minting':
      return 'pending';
    case 'approved':
    case 'issued':
      return 'ready';
    case 'deleted':
      return 'revoked';
    case 'cancelled':
    case 'denied':
    case 'expired':
    case 'failed':
      return status;
  }
}

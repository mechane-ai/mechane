import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { createHook, FatalError, sleep } from 'workflow';
import { deliverRequestNotice } from '../channels/deliver-request-notice.ts';
import type { RunIdentity } from '../execution/types.ts';
import { AccessInput, TokenInput, WaitInput } from './request-schema.ts';
import type {
  AccessInput as AccessArguments,
  DecisionSignal,
  ExternalStatus,
  PreparedRequest,
  RequestCall,
  RequestResult,
  TokenInput as TokenArguments,
  WaitInput as WaitArguments,
} from './request-schema.ts';
import {
  finishRequestWait,
  markRequestWaiting,
  prepareRequest,
  readRequestStatus,
  recordedDecision,
  submitAccess,
  submitToken,
} from './request-steps.ts';

const MAXIMUM_WAIT_MS = 1_800_000;
type SubmitRequest = () => Promise<ExternalStatus>;

export function createRequestTools(context: RunIdentity): ToolSet {
  return {
    request_access: tool({
      description:
        'Request a Nexus capability under the configured service policy. Approval automatically resumes this task; do not ask the user to send another message. Ready permits the operation but does not perform it.',
      inputSchema: AccessInput,
      execute: async (input, options) => await requestAccess({ ...context, toolCallId: options.toolCallId }, input),
    }),
    request_token: tool({
      description:
        'Request a bounded provider token from a Nexus connection, then wait for approval. Uses the current NEXUS_API_KEY identity. When ready, collect it with the Nexus CLI in a subprocess without printing the credential. This tool never returns a secret.',
      inputSchema: TokenInput,
      execute: async (input, options) => await requestToken({ ...context, toolCallId: options.toolCallId }, input),
    }),
    wait_for_request: tool({
      description:
        'Wait durably for an existing Nexus access or token request created by this mech, including a request from the Nexus CLI. Approval resumes this task automatically. Supply its request ID; no user message or polling command is needed.',
      inputSchema: WaitInput,
      execute: async (input, options) => await waitForRequest({ ...context, toolCallId: options.toolCallId }, input),
    }),
  };
}

async function requestAccess(context: RequestCall, input: AccessArguments): Promise<RequestResult> {
  const prepared = await prepareRequest({ context, kind: 'access' });

  return await submitAndWait(prepared, async () => await submitAccess({ ...prepared, input }));
}

async function requestToken(context: RequestCall, input: TokenArguments): Promise<RequestResult> {
  const prepared = await prepareRequest({ context, kind: 'vend' });

  return await submitAndWait(prepared, async () => await submitToken({ ...prepared, input }));
}

async function waitForRequest(context: RequestCall, input: WaitArguments): Promise<RequestResult> {
  const prepared = await prepareRequest({ context, kind: input.kind, requestId: input.requestId });

  return await submitAndWait(prepared, async () => await readRequestStatus(prepared));
}

async function submitAndWait(prepared: PreparedRequest, submit: SubmitRequest): Promise<RequestResult> {
  if (prepared.wait.closedAt !== null) {
    const current = await readRequestStatus(prepared);

    if (current.status === 'pending') {
      return result({
        ...current,
        status: 'failed',
        error: 'This request wait has ended. Create a new request if access is still needed.',
      });
    }

    return result(current);
  }

  const hook = createHook<DecisionSignal>({ token: prepared.wait.hookToken });

  try {
    const conflict = await hook.getConflict();

    if (conflict !== null) {
      throw new FatalError('Another task already owns this request wait.');
    }

    try {
      const response = await submit();

      return await resolveRequest(prepared, response, hook);
    } finally {
      await finishRequestWait(prepared);
    }
  } finally {
    hook.dispose();
  }
}

async function resolveRequest(
  prepared: PreparedRequest,
  initial: ExternalStatus,
  hook: PromiseLike<DecisionSignal>,
): Promise<RequestResult> {
  if (initial.status !== 'pending') {
    if (initial.status === 'ready' && initial.authorization === 'automatic') {
      await deliverRequestNotice({
        runId: prepared.context.runId,
        requestId: prepared.wait.requestId,
        text: 'Nexus granted this request under the configured service policy. Continuing the task.',
      });
    }

    return result(initial);
  }

  await markRequestWaiting(prepared);
  await deliverRequestNotice({
    runId: prepared.context.runId,
    requestId: prepared.wait.requestId,
    text: pendingNotice(initial),
  });

  const hasDecision = await recordedDecision(prepared);

  if (!hasDecision) {
    const expires = deadline(initial);

    await Promise.race([hook, sleep(expires)]);
  }

  const current = await readRequestStatus(prepared);

  if (current.status === 'pending') {
    return result({
      ...current,
      status: 'expired',
      error: 'The task stopped waiting because the approval did not resolve before its deadline.',
    });
  }

  return result(current);
}

function deadline(status: ExternalStatus): Date {
  const maximum = Date.now() + MAXIMUM_WAIT_MS;

  if (status.expiresAt === undefined) {
    return new Date(maximum);
  }

  return new Date(Math.min(maximum, Date.parse(status.expiresAt)));
}

function pendingNotice(status: ExternalStatus): string {
  if (status.approval === null) {
    return 'Nexus is waiting for approval. I will resume this task automatically when the request is resolved.';
  }

  return `Nexus needs approval to continue. [Review the request](${status.approval.url}). I will resume this task automatically after the decision.`;
}

function result(status: ExternalStatus): RequestResult {
  const value: RequestResult = {
    id: status.id,
    kind: status.kind,
    status: status.status,
    approvalUrl: status.approval?.url ?? null,
    authorization: status.authorization ?? null,
    error: status.error,
    collection: null,
  };

  if (status.kind === 'vend' && status.status === 'ready') {
    return { ...value, collection: 'nexus-cli' };
  }

  return value;
}

import { HttpMethod, HttpStatusCode, SandboxOperationId } from '@mechane/records';
import {
  SandboxAction,
  SandboxCheckpointIdentity,
  SandboxCompletionIdentity,
  SandboxExecutionIdentity,
  SandboxExecutionObservation,
  SandboxExecutionResume,
  SandboxExecutionSubmission,
  SandboxRecoveryCheckpointRequest,
  SandboxRequest,
  SandboxServiceIdentity,
  SandboxStopIdentity,
} from '@mechane/sandbox-wire';
import type { SandboxExecutionResult } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { SandboxObject } from '../sandbox-object.ts';
import { authenticate } from './authenticate.ts';
import { serveEvidence } from './evidence-route.ts';
import { serveInteractive } from './interactive-route.ts';
import { InvalidSandboxRequestError, readBody } from './read-body.ts';
import { sandboxStub } from './settings.ts';
import type { SandboxServiceEnvironment } from './settings.ts';

type ServeInput = { readonly request: Request; readonly environment: SandboxServiceEnvironment };
type Stub = DurableObjectStub<SandboxObject>;
const ROUTE_PREFIX_SEGMENTS = 3;
const INTERACTIVE_RESOURCES: ReadonlySet<string> = new Set(['processes', 'browser', 'runs']);

type ExecutionRoute = {
  readonly request: Request;
  readonly stub: Stub;
  readonly url: URL;
  readonly executionId: string;
  readonly action: string | undefined;
};

/** Authenticates the private compute route before binding its owner or dispatching an environment operation. */
export async function serveSandbox({ request, environment }: ServeInput): Promise<Response> {
  if (!(await authenticate({ request, environment }))) {
    return Response.json({ error: 'Unauthorized' }, { status: HttpStatusCode.Unauthorized });
  }

  try {
    return await routeSandbox({ request, environment });
  } catch (error) {
    const isDecodingFailure = Schema.isSchemaError(error) || error instanceof SyntaxError || error instanceof URIError;

    if (isDecodingFailure || error instanceof InvalidSandboxRequestError) {
      return Response.json({ error: 'InvalidRequest' }, { status: HttpStatusCode.BadRequest });
    }

    throw error;
  }
}

async function routeSandbox({ request, environment }: ServeInput): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').slice(ROUTE_PREFIX_SEGMENTS);
  const [workspaceId, mechId, resource, executionId, action, ...remaining] = segments;
  const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)({ workspaceId, mechId });

  if (remaining.length > 0) {
    return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
  }

  const stub = sandboxStub({ environment, identity });

  await stub.bindOwner({ owner: identity });

  const isStopReceipt = resource === 'stop' && executionId !== undefined && action === undefined;

  if (isStopReceipt && request.method === HttpMethod.Get) {
    const stop = Schema.decodeUnknownSync(SandboxStopIdentity)({
      ...identity,
      operationId: decodeURIComponent(executionId),
    });

    const receipt = await stub.readStop({ operationId: stop.operationId });

    if (receipt === null) {
      return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
    }

    return Response.json(receipt);
  }

  if (resource !== undefined && INTERACTIVE_RESOURCES.has(resource)) {
    return await serveInteractive({ request, stub, url, resource, identity: executionId, action });
  }

  if (resource === 'evidence') {
    return await serveEvidence({ request, stub, url, owner: identity, artifactId: executionId, action });
  }

  const isCompletion = resource === 'completions' && executionId !== undefined;

  if (isCompletion && action === undefined && request.method === HttpMethod.Get) {
    const completion = Schema.decodeUnknownSync(SandboxCompletionIdentity)({
      ...identity,
      executionId: decodeURIComponent(executionId),
    });

    const receipt = await stub.completionReceipt({ executionId: completion.executionId });

    if (receipt === null) {
      return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
    }

    return Response.json(receipt);
  }

  const isCheckpoint = resource === 'workspace' && executionId === 'checkpoints';
  const isRecoveryCheckpoint = resource === 'workspace' && executionId === 'recovery-checkpoints';

  if (isRecoveryCheckpoint && action !== undefined && request.method === HttpMethod.Get) {
    const operationId = Schema.decodeUnknownSync(SandboxOperationId)(decodeURIComponent(action));
    const result = await stub.readRecoveryCheckpoint({ operationId });

    if (result === null) {
      return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
    }

    return Response.json(result);
  }

  if (isRecoveryCheckpoint && action !== undefined && request.method === HttpMethod.Post) {
    const operationId = Schema.decodeUnknownSync(SandboxOperationId)(decodeURIComponent(action));
    const decoded = Schema.decodeUnknownSync(SandboxRecoveryCheckpointRequest)(await readBody(request));
    const encoded = Schema.encodeSync(SandboxRecoveryCheckpointRequest)(decoded);
    const result = await stub.retryCheckpoint({ operationId, request: encoded });

    if (result._tag === 'RecoveryCheckpointRefused') {
      return Response.json(result, { status: HttpStatusCode.Conflict });
    }

    if (result._tag === 'Pending') {
      return Response.json(result, { status: HttpStatusCode.Accepted });
    }

    return Response.json(result);
  }

  if (isCheckpoint && action !== undefined && request.method === HttpMethod.Get) {
    const operationId = Schema.decodeUnknownSync(SandboxOperationId)(decodeURIComponent(action));
    const result = await stub.readCheckpoint({ operationId });

    if (result === null) {
      return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
    }

    return Response.json(result);
  }

  if (isCheckpoint && action !== undefined && request.method === HttpMethod.Post) {
    const checkpoint = Schema.decodeUnknownSync(SandboxCheckpointIdentity)({
      ...identity,
      operationId: decodeURIComponent(action),
    });

    const answer = await stub.checkpoint({ operationId: checkpoint.operationId });

    return Response.json(answer);
  }

  if (resource === 'executions' && executionId !== undefined) {
    const decoded = Schema.decodeUnknownSync(SandboxExecutionIdentity)({
      ...identity,
      executionId: decodeURIComponent(executionId),
    });

    return await executionRoute({ request, stub, url, executionId: decoded.executionId, action });
  }

  if (executionId !== undefined || action !== undefined) {
    return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
  }

  if (resource === 'stop' && request.method === HttpMethod.Post) {
    const receipt = await stub.stop();

    return Response.json(receipt, { status: HttpStatusCode.Accepted });
  }

  if (resource === 'workspace') {
    if (request.method === HttpMethod.Get) {
      const report = await stub.manage({ request: { action: SandboxAction.Show, operation_id: null } });

      return Response.json(report);
    }

    if (request.method === HttpMethod.Post) {
      const input = Schema.decodeUnknownSync(SandboxRequest)(await readBody(request));

      const report = await stub.manage({ request: Schema.encodeSync(SandboxRequest)(input) });

      return Response.json(report);
    }
  }

  return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
}

async function executionRoute({ request, stub, url, executionId, action }: ExecutionRoute): Promise<Response> {
  const identity = Schema.decodeUnknownSync(SandboxExecutionIdentity.fields.executionId)(executionId);

  if (action === 'cancel' && request.method === HttpMethod.Post) {
    await stub.cancelExecution({ executionId: identity });

    return new Response(null, { status: HttpStatusCode.NoContent });
  }

  if (action === 'resume' && request.method === HttpMethod.Post) {
    const input = Schema.decodeUnknownSync(SandboxExecutionResume)(await readBody(request));
    const encoded = Schema.encodeSync(SandboxExecutionResume)(input);
    const answer = await stub.resumeExecution({ ...encoded, executionId: identity });

    return executionResponse(answer);
  }

  if (action !== undefined) {
    return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
  }

  if (request.method === HttpMethod.Get) {
    const query = Schema.decodeUnknownSync(SandboxExecutionObservation)({
      waitMs: url.searchParams.get('waitMs') ?? '0',
    });

    const answer = await stub.observeExecution({ executionId: identity, waitMs: query.waitMs });

    return executionResponse(answer);
  }

  if (request.method === HttpMethod.Post) {
    const input = Schema.decodeUnknownSync(SandboxExecutionSubmission)(await readBody(request));
    const encoded = Schema.encodeSync(SandboxExecutionSubmission)(input);
    const answer = await stub.runExecution({ ...encoded, executionId: identity });

    return executionResponse(answer);
  }

  return Response.json({ error: 'NotFound' }, { status: HttpStatusCode.NotFound });
}

function executionResponse(answer: typeof SandboxExecutionResult.Encoded): Response {
  if (answer._tag === 'ExecutionNotFound') {
    return Response.json(answer, { status: HttpStatusCode.NotFound });
  }

  if (answer._tag === 'ExecutionReused') {
    return Response.json(answer, { status: HttpStatusCode.Conflict });
  }

  return Response.json(answer);
}

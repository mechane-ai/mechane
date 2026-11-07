import { HttpMethod, HttpStatusCode } from '@mechane/records';
import type { SandboxObject } from '@mechane/sandbox';
import {
  SandboxAction,
  SandboxExecutionIdentity,
  SandboxExecutionObservation,
  SandboxExecutionResume,
  SandboxExecutionSubmission,
  SandboxRequest,
  SandboxServiceIdentity,
} from '@mechane/sandbox-wire';
import type { SandboxExecutionResult } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { authenticate } from './authenticate.ts';
import { InvalidSandboxRequestError, readBody } from './read-body.ts';
import { sandboxStub } from './settings.ts';
import type { ServiceEnvironment } from './settings.ts';

type ServeInput = { readonly request: Request; readonly environment: ServiceEnvironment };
type Stub = DurableObjectStub<SandboxObject>;
const ROUTE_PREFIX_SEGMENTS = 3;

type ExecutionRoute = {
  readonly request: Request;
  readonly stub: Stub;
  readonly url: URL;
  readonly executionId: string;
  readonly action: string | undefined;
};

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
    await stub.stop();

    return new Response(null, { status: HttpStatusCode.NoContent });
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

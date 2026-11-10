import { BrowserEvidenceProgress } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import {
  BrowserProgress,
  BrowserRequestId,
  ProcessHandle,
  ProcessId,
  SandboxBrowserSubmission,
  SandboxProcessSubmission,
  SandboxRunId,
} from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import type { SandboxObject } from '../sandbox-object.ts';
import { InvalidSandboxRequestError, readBody } from './read-body.ts';

const HANDLE_ACTIONS: ReadonlySet<string> = new Set(['read', 'stop']);

type InteractiveRouteInput = {
  readonly request: Request;
  readonly stub: DurableObjectStub<SandboxObject>;
  readonly url: URL;
  readonly resource: string;
  /** Absent selects the process collection. */
  readonly identity: string | undefined;
  /** Absent selects submission or observation of the original receipt. */
  readonly action: string | undefined;
};

/** Private service admission precedes exact-identity operations; observations never create machines or actions. */
export async function serveInteractive(input: InteractiveRouteInput): Promise<Response> {
  switch (input.resource) {
    case 'processes':
      return await processRoute(input);
    case 'browser':
      return await browserRoute(input);
    case 'runs':
      if (input.identity !== undefined && input.action === 'cancel' && input.request.method === HttpMethod.Post) {
        const runId = Schema.decodeUnknownSync(SandboxRunId)(decodeURIComponent(input.identity));

        await input.stub.cancelInteractiveRun({ runId });

        return new Response(null, { status: HttpStatusCode.NoContent });
      }

      return notFound();
    default:
      return notFound();
  }
}

async function processRoute({ request, stub, url, identity, action }: InteractiveRouteInput): Promise<Response> {
  const shouldTouch = url.searchParams.get('touch') === 'true';

  if (identity === undefined) {
    if (request.method === HttpMethod.Get && action === undefined) {
      return Response.json(await stub.listProcesses({ shouldTouch }));
    }

    return notFound();
  }

  const processId = Schema.decodeUnknownSync(ProcessId)(decodeURIComponent(identity));

  if (action !== undefined && HANDLE_ACTIONS.has(action) && request.method === HttpMethod.Post) {
    const handle = Schema.decodeUnknownSync(ProcessHandle, { onExcessProperty: 'error' })(await readBody(request));

    if (handle.processId !== processId) {
      throw new InvalidSandboxRequestError();
    }

    const encoded = Schema.encodeSync(ProcessHandle)(handle);

    if (action === 'read') {
      return Response.json(await stub.readProcess({ handle: encoded, shouldTouch }));
    }

    return Response.json(await stub.stopProcess({ handle: encoded }));
  }

  if (action !== undefined) {
    return notFound();
  }

  if (request.method === HttpMethod.Get) {
    return Response.json(await stub.observeProcessStart({ processId }));
  }

  if (request.method === HttpMethod.Post) {
    const input = Schema.decodeUnknownSync(SandboxProcessSubmission, { onExcessProperty: 'error' })(
      await readBody(request),
    );

    if (input.request.processId !== processId) {
      throw new InvalidSandboxRequestError();
    }

    return Response.json(await stub.startProcess(Schema.encodeSync(SandboxProcessSubmission)(input)));
  }

  return notFound();
}

async function browserRoute({ request, stub, identity, action }: InteractiveRouteInput): Promise<Response> {
  if (identity === undefined || (action !== undefined && action !== 'abandon')) {
    return notFound();
  }

  const requestId = Schema.decodeUnknownSync(BrowserRequestId)(decodeURIComponent(identity));

  if (request.method === HttpMethod.Get && action === undefined) {
    return Response.json(await stub.observeBrowser({ requestId }));
  }

  if (request.method === HttpMethod.Post) {
    const input = Schema.decodeUnknownSync(SandboxBrowserSubmission, { onExcessProperty: 'error' })(
      await readBody(request),
    );

    if (input.request.requestId !== requestId) {
      const progress = BrowserProgress.cases.Failed.make({
        reason: 'Browser request identity does not match its route',
      });

      const evidence = Option.none();
      const answer = Schema.encodeSync(BrowserEvidenceProgress)({ progress, evidence });

      return Response.json(answer, { status: HttpStatusCode.Conflict });
    }

    const submission = Schema.encodeSync(SandboxBrowserSubmission)(input);

    if (action === 'abandon') {
      return Response.json(await stub.abandonBrowser(submission));
    }

    return Response.json(await stub.runBrowser(submission));
  }

  return notFound();
}

function notFound(): Response {
  return new Response(null, { status: HttpStatusCode.NotFound });
}

import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { Bytes, RandomId } from '@mechane/records';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Cause, Effect, Exit, Record, Schema } from 'effect';
import { createServer } from 'node:http';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { EvalCallId } from '../application-schemas.ts';
import type { EvalToolResult } from '../application-schemas.ts';
import type { ExecuteToolInput, Json } from '../application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation, EvalTransportFailed, EvalTransportOperation } from '../errors.ts';
import type { EvalRunFailure } from '../types.ts';

type ServerIssue = { readonly reason: string };

type EnvironmentServerInput = {
  readonly token: string;
  readonly path: string;
  readonly tools: ReadonlyArray<Tool>;
  readonly maxRequestBytes: Bytes;
  readonly execute: (input: ExecuteToolInput) => Effect.Effect<EvalToolResult, EvalRunFailure>;
  readonly onIssue: (input: ServerIssue) => void;
};

type EnvironmentServer = { readonly origin: URL; readonly release: Effect.Effect<void, EvalTransportFailed> };

type HttpRequestInput = {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly input: EnvironmentServerInput;
  readonly token: string;
  readonly path: string;
  readonly tools: ReadonlyArray<Tool>;
  readonly signal: AbortSignal;
  readonly execute: EnvironmentServerInput['execute'];
};

type RequestBodyInput = { readonly request: IncomingMessage; readonly maxRequestBytes: Bytes };
type ListenInput = { readonly server: HttpServer };

type CloseInput = {
  readonly server: HttpServer;
  readonly pending: ReadonlyMap<AbortController, Promise<void>>;
  readonly startClosing: () => void;
};

type OwnedRequestInput = {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly controller: AbortController;
};

type RespondToRequest = (input: OwnedRequestInput) => Promise<void>;
type BuildMcpPathInput = { readonly id: RandomId };

const LOOPBACK_HOST = '127.0.0.1';
const JsonFields = Schema.Record(Schema.String, Schema.Json);
const BoundAddress = Schema.Struct({ port: Schema.Int });

const CallMetadata = Schema.Struct({
  params: Schema.Struct({ _meta: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)) }),
});

/** Private fixture routes do not expose a case name or rubric identity. */
export function buildMcpPath({ id }: BuildMcpPathInput): string {
  return `/mcp/${id}`;
}

/** The native callback boundary owns and joins every HTTP request before shutdown. */
export const openEnvironmentServer = Effect.fn('openEnvironmentServer')(function* (
  input: EnvironmentServerInput,
): Effect.fn.Return<EnvironmentServer, EvalTransportFailed> {
  const { token, path, tools, execute } = input;
  const pending = new Map<AbortController, Promise<void>>();
  const state = { isClosing: false };

  const startClosing: () => void = () => {
    state.isClosing = true;
  };

  const respond: RespondToRequest = async ({ request, response, controller }) => {
    function onAbort(): void {
      request.destroy();
    }

    controller.signal.addEventListener('abort', onAbort, { once: true });

    const responding = Effect.tryPromise({
      try: () =>
        handleHttpRequest({ request, response, input, token, path, tools, execute, signal: controller.signal }),
      catch: (cause) =>
        new EvalTransportFailed({ operation: EvalTransportOperation.ServeRequest, reason: String(cause) }),
    }).pipe(
      Effect.catchTags({
        EvalTransportFailed: (failure) =>
          Effect.sync(() => {
            if (controller.signal.aborted) {
              return;
            }

            input.onIssue({ reason: failure.reason });

            if (!response.headersSent) {
              response.writeHead(HttpStatusCode.InternalServerError, { [HttpHeader.ContentType]: MediaType.Json });
              response.end(JSON.stringify({ error: 'The eval tool request could not be recorded' }));
            }
          }),
      }),
    );

    try {
      const completed = await Effect.runPromiseExit(responding);

      if (Exit.isFailure(completed) && !controller.signal.aborted) {
        input.onIssue({ reason: Cause.pretty(completed.cause) });
      }
    } finally {
      controller.signal.removeEventListener('abort', onAbort);
      pending.delete(controller);
    }
  };

  const server = createServer((request, response) => {
    if (state.isClosing) {
      response.writeHead(HttpStatusCode.Unavailable);
      response.end();

      return;
    }

    const controller = new AbortController();
    const completion = respond({ request, response, controller });

    pending.set(controller, completion);

    void completion;
  });

  const port = yield* listen({ server });
  const origin = new URL(`http://${LOOPBACK_HOST}:${port}`);

  return { origin, release: closeServer({ server, pending, startClosing }) };
});

async function handleHttpRequest({
  request,
  response,
  input,
  token,
  path,
  tools,
  execute,
  signal,
}: HttpRequestInput): Promise<void> {
  if (request.url === '/health') {
    response.writeHead(HttpStatusCode.Ok, { [HttpHeader.ContentType]: MediaType.Json });
    response.end(JSON.stringify({ service: 'mechane-eval' }));

    return;
  }

  if (request.url !== path || request.headers.authorization !== `Bearer ${token}`) {
    response.writeHead(HttpStatusCode.NotFound);
    response.end();

    return;
  }

  if (request.method !== HttpMethod.Post) {
    response.writeHead(HttpStatusCode.MethodNotAllowed);
    response.end();

    return;
  }

  const body = await readRequestBody({ request, maxRequestBytes: input.maxRequestBytes });
  const protocol = new McpServer({ name: 'mechane-eval', version: '3' }, { capabilities: { tools: {} } });

  protocol.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [...tools] }));
  protocol.server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const callId = readCallIdentity({ request, body });
    const argumentsValue = Schema.decodeUnknownSync(Schema.Json)(params.arguments ?? {});

    const result = await Effect.runPromise(execute({ name: params.name, arguments: argumentsValue, callId }), {
      signal,
    });

    const structuredContent = toStructuredContent({ output: result.output });

    return {
      isError: result.isError,
      content: [{ type: 'text', text: JSON.stringify(result.output) }],
      structuredContent,
    };
  });

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });

  await protocol.connect(transport);

  try {
    const headers = new Headers();

    for (const [name, value] of Record.toEntries(request.headers)) {
      if (typeof value === 'string') {
        headers.set(name, value);
      }
    }

    headers.delete(HttpHeader.ContentLength);

    const webRequest = new Request(`http://localhost${path}`, {
      method: HttpMethod.Post,
      headers,
      body: JSON.stringify(body),
    });

    const served = await transport.handleRequest(webRequest, { parsedBody: body });
    const contents = await served.arrayBuffer();

    response.writeHead(served.status, Record.fromEntries(served.headers));
    response.end(Buffer.from(contents));
  } finally {
    await protocol.close();
  }
}

type ReadCallIdentityInput = { readonly request: IncomingMessage; readonly body: Json };
type StructuredContentInput = { readonly output: Json };

function readCallIdentity({ request, body }: ReadCallIdentityInput): EvalCallId {
  const supplied = request.headers['x-mechane-tool-call-id'];

  if (typeof supplied === 'string') {
    return Schema.decodeUnknownSync(EvalCallId)(supplied);
  }

  const metadata = Schema.decodeUnknownSync(CallMetadata)(body);
  const { _meta: values } = metadata.params;

  if (values === undefined) {
    throw new EvalAdapterFailed({
      operation: EvalAdapterOperation.ReadCallIdentity,
      reason: 'The tool call has no stable caller identity',
    });
  }

  return Schema.decodeUnknownSync(EvalCallId)(values['mechane/toolCallId']);
}

function toStructuredContent({ output }: StructuredContentInput): typeof JsonFields.Type {
  if (Schema.is(JsonFields)(output)) {
    return output;
  }

  return { output };
}

async function readRequestBody({ request, maxRequestBytes }: RequestBodyInput): Promise<Json> {
  const chunks: Array<Buffer> = [];
  const total = { bytes: 0 };

  for await (const chunk of request) {
    const buffer = Schema.decodeUnknownSync(Schema.instanceOf(Buffer))(chunk);

    total.bytes += buffer.byteLength;

    if (total.bytes > maxRequestBytes) {
      throw new EvalTransportFailed({
        operation: EvalTransportOperation.ReadRequest,
        reason: 'The request exceeds the frozen byte bound',
      });
    }

    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8');

  if (text.length === 0) {
    return {};
  }

  return Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json))(text);
}

const listen = Effect.fn('listen')(function* ({ server }: ListenInput): Effect.fn.Return<number, EvalTransportFailed> {
  yield* Effect.callback<void, EvalTransportFailed>((resume) => {
    server.once('error', (cause) =>
      resume(Effect.fail(new EvalTransportFailed({ operation: EvalTransportOperation.Listen, reason: String(cause) }))),
    );
    server.listen(0, LOOPBACK_HOST, () => resume(Effect.void));
  });

  const address = yield* Schema.decodeUnknownEffect(BoundAddress)(server.address()).pipe(
    Effect.mapError(
      (failure) => new EvalTransportFailed({ operation: EvalTransportOperation.ReadListener, reason: failure.message }),
    ),
  );

  return address.port;
});

const closeServer = Effect.fn('closeServer')(function* ({
  server,
  pending,
  startClosing,
}: CloseInput): Effect.fn.Return<void, EvalTransportFailed> {
  startClosing();

  for (const controller of pending.keys()) {
    controller.abort();
  }

  server.closeAllConnections();

  yield* Effect.tryPromise({
    try: () => Promise.allSettled(pending.values()),
    catch: (cause) =>
      new EvalTransportFailed({ operation: EvalTransportOperation.JoinRequests, reason: String(cause) }),
  });

  if (!server.listening) {
    return;
  }

  yield* Effect.callback<void, EvalTransportFailed>((resume) => {
    server.close((cause) => {
      if (cause !== undefined) {
        resume(
          Effect.fail(
            new EvalTransportFailed({ operation: EvalTransportOperation.CloseListener, reason: String(cause) }),
          ),
        );

        return;
      }

      resume(Effect.void);
    });
  });
});

import { createMCPClient } from '@ai-sdk/mcp';
import type { ListToolsResult, MCPClient } from '@ai-sdk/mcp';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import { MCP_MAX_LIST_PAGES, MCP_MAX_TOOLS, TOOL_REQUEST_TIMEOUT_MS } from '../../tools/constants.ts';
import { boundedToolFetch } from '../../tools/http.ts';
import { verifyManagedHost } from '../egress.ts';
import type { ManagedWireObject } from '../protocol.ts';
import { issueManagedMcpIdentity, validateManagedMcpIdentity } from './identity.ts';
import { managedMcpUrl, MCP_RESPONSE_BUFFER_BYTES } from './settings.ts';
import type { ManagedMcpContext } from './types.ts';

export class ManagedMcpAuthenticationError extends Error {
  override readonly name = 'ManagedMcpAuthenticationError';
}

type Connection = {
  readonly client: MCPClient;
  readonly secrets: ReadonlySet<string>;
  readonly isAuthenticationFailed: boolean;
  readonly isResponseTruncated: boolean;
};

const RpcMethod = Schema.Struct({ method: Schema.String });

const rejectedPostResponses: ReadonlySet<number> = new Set([
  HttpStatusCode.NotFound,
  HttpStatusCode.MethodNotAllowed,
  HttpStatusCode.NotAcceptable,
  HttpStatusCode.UnsupportedMediaType,
]);

const authorizationFailures: ReadonlySet<number> = new Set([HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden]);

function methodOf(body: unknown): string | null {
  if (typeof body !== 'string') {
    return null;
  }

  const message: unknown = JSON.parse(body);

  if (Schema.is(RpcMethod)(message)) {
    return message.method;
  }

  return null;
}

function isSseDestination(url: URL, declared: URL): boolean {
  if (url.origin !== declared.origin || !url.pathname.startsWith(new URL('.', declared).pathname)) {
    return false;
  }

  const credentialsOrFragment = [url.username, url.password, url.hash].some((value) => value.length > 0);

  return !credentialsOrFragment && !/%2f|%5c/iu.test(url.pathname);
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof Request) {
    return new URL(input.url);
  }

  return new URL(input);
}

export async function connectManagedMcp(
  context: ManagedMcpContext,
  server: ManagedWireObject,
  beforeDispatch?: () => Promise<void>,
): Promise<Connection> {
  const name = server['name'];
  const target = server['url'];

  if (typeof name !== 'string' || typeof target !== 'string') {
    throw new TypeError('Invalid session MCP server');
  }

  const url = managedMcpUrl(target, context.settings);

  const grant = {
    workspaceId: context.workspaceId,
    sessionId: context.sessionId,
    agentId: context.agentId,
    serverName: name,
    serverUrl: target,
  };

  const secrets = new Set<string>();
  const status = { isAuthenticationFailed: false, isSse: false, hasRejectedPost: false, isResponseTruncated: false };

  const request = boundedToolFetch({
    signal: context.signal,
    maximumBytes: MCP_RESPONSE_BUFFER_BYTES,
    onExceeded() {
      status.isResponseTruncated = true;
    },
  });

  let hasCredential = false;

  const guardedFetch: typeof fetch = async (input, init) => {
    const destination = requestUrl(input);

    if (destination.href !== url.href) {
      const allowsSsePost = status.isSse && init?.method === HttpMethod.Post;

      if (!allowsSsePost || !isSseDestination(destination, url)) {
        throw new Error('Managed MCP transport destination changed');
      }
    }

    await verifyManagedHost({ url: destination, ...context.settings });

    const isCall = methodOf(init?.body) === 'tools/call';
    const headers = new Headers(init?.headers);

    try {
      const requested: typeof grant & { threadId?: string } = { ...grant };

      if (isCall) {
        requested.threadId = context.threadId;
      }

      const { token, actor, server: admitted } = await context.authorize(requested);

      const isDeclared = admitted['name'] === name && admitted['url'] === target;
      const isRevoked = hasCredential && token === null;

      if (!isDeclared || isRevoked) {
        throw new Error('MCP credential is no longer available');
      }

      hasCredential ||= token !== null;

      if (destination.href !== url.href) {
        const receiver = new URL(destination);
        receiver.search = '';

        validateManagedMcpIdentity({
          configuration: context.settings.agentIdentity,
          server: { ...admitted, url: receiver.href },
        });
      }

      const identity = await issueManagedMcpIdentity({
        configuration: context.settings.agentIdentity,
        server: admitted,
        agentId: context.agentId,
        actor: actor ?? undefined,
      });

      if (token !== null && identity?.header !== 'Authorization') {
        const value = Redacted.value(token);

        headers.set(HttpHeader.Authorization, `Bearer ${value}`);
        secrets.add(value);
      }

      if (identity !== null) {
        const value = Redacted.value(identity.value);

        headers.set(identity.header, value);
        secrets.add(value.replace(/^Bearer /u, ''));
      }
    } catch {
      status.isAuthenticationFailed = true;

      throw new ManagedMcpAuthenticationError('MCP authorization failed');
    }

    if (isCall) {
      if (beforeDispatch === undefined) {
        throw new Error('MCP discovery cannot invoke a tool');
      }

      await beforeDispatch();
    }

    const response = await request(input, { ...init, headers });

    if (!isCall && init?.method === HttpMethod.Post && rejectedPostResponses.has(response.status)) {
      status.hasRejectedPost = true;
    }

    if (authorizationFailures.has(response.status)) {
      status.isAuthenticationFailed = true;
    }

    return response;
  };

  async function open(type: 'http' | 'sse') {
    return await createMCPClient({
      transport: { type, url: url.href, fetch: guardedFetch },
      maxRetries: 0,
      initializationOptions: { timeout: TOOL_REQUEST_TIMEOUT_MS, maxTotalTimeout: TOOL_REQUEST_TIMEOUT_MS },
    });
  }

  async function negotiate() {
    try {
      return await open('http');
    } catch (error) {
      if (!status.hasRejectedPost || status.isAuthenticationFailed) {
        throw error;
      }

      status.isSse = true;

      return await open('sse');
    }
  }

  try {
    const client = await negotiate();

    return {
      client,
      secrets,
      get isResponseTruncated() {
        return status.isResponseTruncated;
      },
      get isAuthenticationFailed() {
        return status.isAuthenticationFailed;
      },
    };
  } catch (error) {
    if (status.isAuthenticationFailed) {
      throw new ManagedMcpAuthenticationError('MCP authorization failed');
    }

    throw error;
  }
}

export async function managedMcpDefinitions(client: MCPClient) {
  const tools: ListToolsResult['tools'] = [];
  const seen = new Set<string>();
  const page: { cursor?: string } = {};

  for (let pageIndex = 0; pageIndex < MCP_MAX_LIST_PAGES; pageIndex += 1) {
    const entries = await client.listTools({ params: page, options: { timeout: TOOL_REQUEST_TIMEOUT_MS } });

    tools.push(...entries.tools);

    if (tools.length > MCP_MAX_TOOLS) {
      throw new Error('MCP tool limit exceeded');
    }

    if (entries.nextCursor === undefined || entries.nextCursor === '') {
      return tools;
    }

    if (seen.has(entries.nextCursor)) {
      throw new Error('MCP tool cursor repeated');
    }

    seen.add(entries.nextCursor);

    page.cursor = entries.nextCursor;
  }

  throw new Error('MCP tool page limit exceeded');
}

export async function closeManagedMcp(client: MCPClient): Promise<void> {
  // Remote session teardown cannot change the outcome of a completed tool call.
  await client.close().catch(() => undefined);
}

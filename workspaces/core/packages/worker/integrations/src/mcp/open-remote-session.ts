import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/client/validators/cf-worker';
import { Duration, Option, Redacted } from 'effect';
import { boundedRemoteFetch } from './bounded-remote-fetch.ts';
import { REMOTE_TIMEOUT_MS } from './constants.ts';
import type { RemoteMcpInput, RemoteSession } from './types.ts';

const RECONNECTION_DELAY_MS = Duration.toMillis(Duration.zero);

const REMOTE_LIST_MAX_PAGES = 8;

const REMOTE_TRANSPORT_NAME = 'mechane';

const REMOTE_TRANSPORT_VERSION = '1.0.0';

const REMOTE_RECONNECTION_OPTIONS = {
  maxRetries: 0,
  maxReconnectionDelay: RECONNECTION_DELAY_MS,
  initialReconnectionDelay: RECONNECTION_DELAY_MS,
  reconnectionDelayGrowFactor: 1,
} as const;

/** Uses the initialize-based MCP protocol with one deadline and no transport or authentication fallback. */
export function openRemoteSession({ connection, token, signal: callerSignal }: RemoteMcpInput): RemoteSession {
  const deadline = AbortSignal.timeout(REMOTE_TIMEOUT_MS);

  const signal = Option.match(callerSignal, {
    onNone: () => deadline,
    onSome: (caller) => AbortSignal.any([caller, deadline]),
  });

  const jsonSchemaValidator = new CfWorkerJsonSchemaValidator();

  const client = new Client(
    { name: REMOTE_TRANSPORT_NAME, version: REMOTE_TRANSPORT_VERSION },
    { jsonSchemaValidator, listMaxPages: REMOTE_LIST_MAX_PAGES, versionNegotiation: { mode: 'legacy' } },
  );

  const headers = new Headers();

  if (Option.isSome(token)) {
    const credential = Redacted.value(token.value);
    const authorization = bearerAuthorization({ token: credential });

    headers.set(HttpHeader.Authorization, authorization);
  }

  const fetch = boundedRemoteFetch({ signal });

  const transport = new StreamableHTTPClientTransport(connection.url, {
    requestInit: { headers, redirect: 'manual', signal },
    fetch,
    reconnectionOptions: REMOTE_RECONNECTION_OPTIONS,
    onInsufficientScope: 'throw',
  });

  return { client, transport, abortSignal: signal };
}

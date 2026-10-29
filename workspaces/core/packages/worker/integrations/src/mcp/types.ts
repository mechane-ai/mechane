import type { RemoteConnection } from '@mechane/protocol';
import type { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { Option, Redacted } from 'effect';

/** An invocation is checked against current metadata and a fresh grant before dispatch. */
export type RemoteMcpInvocation = { readonly toolName: string; readonly arguments: Readonly<Record<string, unknown>> };

/** The trusted caller supplies scoped credentials and a live authorization callback. */
export type RemoteMcpInput = {
  readonly connection: RemoteConnection;
  readonly tools: ReadonlyArray<string>;
  /** None sends an unauthenticated request to the explicitly configured remote URL. */
  readonly token: Option.Option<Redacted.Redacted>;
  /** None requests tool metadata without invoking a remote tool. */
  readonly invocation: Option.Option<RemoteMcpInvocation>;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
  readonly authorize: () => Promise<boolean>;
};

/** The client and transport share one cancellation deadline for the whole operation. */
export type RemoteSession = {
  readonly client: Client;
  readonly transport: StreamableHTTPClientTransport;
  readonly abortSignal: AbortSignal;
};

/** Each received chunk contributes to the session-wide aggregate response budget. */
export type RemoteByteCount = { readonly bytes: number };

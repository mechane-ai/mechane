import type { ExecutionEnvironment } from '@mechane/sandbox-wire';

export type RuntimeToolContext = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly runId: string;
};

export type ToolInvocation = RuntimeToolContext & { readonly toolCallId: string };

export type BashArguments = { readonly command: string; readonly timeoutMs: number };

export type BashInvocation = ToolInvocation & BashArguments;

export type PreparedEnvironment = typeof ExecutionEnvironment.Encoded;

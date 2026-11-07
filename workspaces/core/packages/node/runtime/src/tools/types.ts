export type RuntimeToolContext = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly runId: string;
};

export type ToolInvocation = RuntimeToolContext & { readonly toolCallId: string };

export type BashArguments = { readonly command: string; readonly timeoutMs: number };

export type BashInvocation = ToolInvocation & BashArguments;

export type PreparedEnvironment = {
  readonly environment: {
    readonly variables: Readonly<Record<string, string>>;
    readonly secrets: Readonly<Record<string, string>>;
  };
  readonly githubToken: string | null;
};

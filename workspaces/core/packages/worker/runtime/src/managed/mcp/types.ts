import type { Redacted } from 'effect';
import type { ManagedWireObject } from '../protocol.ts';
import type { ManagedMcpSettings } from './settings.ts';

export type ManagedMcpTool = {
  readonly name: string;
  readonly serverName: string;
  readonly modelName: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
};

export type ManagedMcpTarget = {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly serverName: string;
  readonly serverUrl: string;
  readonly threadId?: string;
};

export type ManagedMcpContext = {
  readonly settings: ManagedMcpSettings;
  readonly workspaceId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly servers: ReadonlyArray<ManagedWireObject>;
  readonly threadId: string;
  readonly authorize: (
    target: ManagedMcpTarget,
  ) => Promise<{
    readonly server: ManagedWireObject;
    readonly token: Redacted.Redacted | null;
    readonly actor: { readonly issuer: string; readonly subject: string } | null;
  }>;
  readonly signal?: AbortSignal | undefined;
};

export type ManagedMcpResult = { readonly content: ReadonlyArray<ManagedWireObject>; readonly is_error: boolean };

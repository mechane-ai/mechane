import type { PluggableSandboxProvider, SandboxHandle, SandboxSnapshot, SandboxStopResult } from './schemas.ts';

export type SandboxLeaseSpecification = {
  readonly workspaceId: string;
  readonly environmentId: string;
  readonly sessionId: string;
  readonly generation: number;
  readonly workId: string;
  readonly workSecret: string;
  readonly apiOrigin: string;
  readonly image: string;
  readonly existingSandboxId: string | null;
  readonly snapshotId: string | null;
  readonly cpuCores?: number | undefined;
  readonly memoryMegabytes?: number | undefined;
  readonly timeoutSeconds?: number | undefined;
  readonly environment?: Readonly<Record<string, string>> | undefined;
};

export type SandboxIdentifierInput = { readonly sandboxId: string };

export type SandboxStopInput = { readonly sandboxId: string; readonly shouldSnapshot?: boolean | undefined };

/** Minimal 5-method vendor-neutral sandbox lifecycle contract. */
export type SandboxProviderAdapter = {
  readonly kind: PluggableSandboxProvider;
  readonly startOrResume: (specification: SandboxLeaseSpecification) => Promise<SandboxHandle>;
  readonly snapshot: (input: SandboxIdentifierInput) => Promise<SandboxSnapshot>;
  readonly status: (input: SandboxIdentifierInput) => Promise<SandboxHandle>;
  readonly stop: (input: SandboxStopInput) => Promise<SandboxStopResult>;
  readonly destroy: (input: SandboxIdentifierInput) => Promise<void>;
};

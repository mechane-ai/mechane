import type { ControlStore, ManagedScope } from '@mechane/control-store';
import type { ActorNamespace, RuntimeConfiguration } from '@mechane/runtime';

export type ManagedRequest = {
  readonly operation: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly request: Request;
  readonly store: ControlStore;
  readonly scope: ManagedScope;
  readonly configuration: RuntimeConfiguration;
  readonly actors: ActorNamespace;
  readonly scheduleSessionOpen: (target: { readonly scope: ManagedScope; readonly id: string }) => void;
  readonly wakeInstalledSession: (input: {
    readonly workspaceId: string;
    readonly sessionId: string;
    readonly environmentId: string;
  }) => void;
  readonly workerSession?: { readonly workspaceId: string; readonly sessionId: string; readonly leaseId: string };
};

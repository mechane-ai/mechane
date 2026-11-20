import type { SlotNamespace } from '@mechane/agent-slot';
import type { ControlStore, ManagedScope } from '@mechane/control-store';
import type { RuntimeConfiguration } from '@mechane/runtime';

export type ManagedRequest = {
  readonly operation: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly request: Request;
  readonly store: ControlStore;
  readonly scope: ManagedScope;
  readonly configuration: RuntimeConfiguration;
  readonly sessions: Pick<SlotNamespace, 'getByName'>;
  readonly slots: Pick<SlotNamespace, 'getByName'>;
  readonly scheduleSessionOpen: (target: { readonly scope: ManagedScope; readonly id: string }) => void;
  readonly wakeInstalledSession: (input: {
    readonly workspaceId: string;
    readonly sessionId: string;
    readonly environmentId: string;
  }) => void;
  readonly destroyInstalledSession: (input: {
    readonly workspaceId: string;
    readonly sessionId: string;
    readonly environmentId: string;
  }) => Promise<void>;
  readonly workspaceFiles: R2Bucket | undefined;
  readonly workerSession?: { readonly workspaceId: string; readonly sessionId: string; readonly leaseId: string };
};

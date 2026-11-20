import type { SlotNamespace } from '@mechane/agent-slot';
import type { RuntimeEnvironment } from '@mechane/runtime';
import type { SandboxServiceEnvironment } from '@mechane/sandbox';

type AssetBinding = { readonly fetch: (request: Request) => Promise<Response> };

export type WorkerEnvironment = RuntimeEnvironment &
  SandboxServiceEnvironment & {
    readonly AGENT_SLOTS: SlotNamespace;
    readonly SESSIONS: SlotNamespace;
    readonly ASSETS: AssetBinding;
    readonly HYPERDRIVE?: Hyperdrive;
  };

type WorkerBindingsInput = { readonly environment: WorkerEnvironment };

export function loadWorkerBindings({ environment }: WorkerBindingsInput) {
  return {
    slots: environment.AGENT_SLOTS,
    sessions: environment.SESSIONS,
    assets: environment.ASSETS,
    workspaceFiles: environment.WORKSPACE_FILES,
  };
}

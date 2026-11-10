import type { ActorNamespace, RuntimeEnvironment } from '@mechane/runtime';
import type { SandboxServiceEnvironment } from '@mechane/sandbox';

type AssetBinding = { readonly fetch: (request: Request) => Promise<Response> };

export type WorkerEnvironment = RuntimeEnvironment &
  SandboxServiceEnvironment & { readonly MECHS: ActorNamespace; readonly ASSETS: AssetBinding };

type WorkerBindingsInput = { readonly environment: WorkerEnvironment };

export function loadWorkerBindings({ environment }: WorkerBindingsInput) {
  return { actors: environment.MECHS, assets: environment.ASSETS };
}

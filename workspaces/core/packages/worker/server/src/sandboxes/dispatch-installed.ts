import type { ControlStore } from '@mechane/control-store';
import type { ActorNamespace, RuntimeConfiguration } from '@mechane/runtime';
import { reconcileLostWork } from '../managed/work-recovery.ts';
import { awaitInstalledProgress } from './await-installed-progress.ts';
import { resumeInstalledStartup, waitForInstalledRelease } from './reconcile-installed.ts';

type DispatchInstalledInput = {
  readonly store: ControlStore;
  readonly configuration: RuntimeConfiguration;
  readonly actors: ActorNamespace;
  readonly workspaceId: string;
  readonly environmentId: string;
  readonly sessionId: string;
};

export async function dispatchInstalledSession({
  store,
  configuration,
  actors,
  workspaceId,
  environmentId,
  sessionId,
}: DispatchInstalledInput): Promise<{ readonly hasReleasedCapacity: boolean }> {
  await reconcileLostWork({ store, actors, workspaceId, environmentId, sessionId });

  const hasReleasedCapacity = await waitForInstalledRelease({
    store,
    configuration,
    workspaceId,
    environmentId,
    sessionId,
  });

  const apiOrigin = configuration.toolOrigin;

  const claim = await store.managed.worker.claimInstalledWork({
    workspaceId,
    environmentId,
    sessionId,
    origin: apiOrigin,
    signingKey: configuration.sandbox.bearer,
    maximumMachines: configuration.maxMachines,
  });

  const session = { workspaceId, environmentId, sessionId };
  const allocation = claim ?? (await store.managed.worker.allocations.status(session));

  if (allocation !== null) {
    const target = { ...session, generation: allocation.generation };

    await awaitInstalledProgress(() => resumeInstalledStartup({ store, configuration }, target));
  }

  return { hasReleasedCapacity };
}

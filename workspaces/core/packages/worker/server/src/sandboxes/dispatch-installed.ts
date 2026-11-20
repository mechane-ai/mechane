import type { SlotNamespace } from '@mechane/agent-slot';
import type { ControlStore } from '@mechane/control-store';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { reconcileLostWork } from '../managed/work-recovery.ts';
import { awaitInstalledProgress } from './await-installed-progress.ts';
import { resolveSandboxBackend } from './provider-dispatch.ts';
import { resumeInstalledStartup, waitForInstalledRelease } from './reconcile-installed.ts';

type DispatchInstalledInput = {
  readonly store: ControlStore;
  readonly configuration: RuntimeConfiguration;
  readonly sessions: Pick<SlotNamespace, 'getByName'>;
  readonly workspaceId: string;
  readonly environmentId: string;
  readonly sessionId: string;
};

export async function dispatchInstalledSession({
  store,
  configuration,
  sessions,
  workspaceId,
  environmentId,
  sessionId,
}: DispatchInstalledInput): Promise<{ readonly hasReleasedCapacity: boolean }> {
  const backend = resolveSandboxBackend(configuration);

  if (backend.kind === 'none') {
    return { hasReleasedCapacity: false };
  }

  await reconcileLostWork({ store, sessions, workspaceId, environmentId, sessionId });

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

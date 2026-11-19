import type { ControlStore, InstalledSession } from '@mechane/control-store';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { releaseManagedSandboxWorker, startManagedSandboxWorker, touchManagedSandboxWorker } from '@mechane/runtime';
import { awaitInstalledProgress } from './await-installed-progress.ts';

type ReconcileContext = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };

type AllocationCheck = InstalledSession & {
  readonly generation: number;
  readonly action: 'start' | 'touch' | 'release';
};

async function reconcileAllocation({ store, configuration }: ReconcileContext, allocation: AllocationCheck) {
  const binding = {
    workspaceId: allocation.workspaceId,
    environmentId: allocation.environmentId,
    sessionId: allocation.sessionId,
    generation: allocation.generation,
    sandbox: configuration.sandbox,
  };

  if (allocation.action === 'release') {
    await releaseManagedSandboxWorker(binding);
    await store.managed.worker.allocations.confirmRelease(allocation);

    return;
  }

  if (allocation.action === 'start') {
    await resumeInstalledStartup({ store, configuration }, allocation);

    return;
  }

  await touchManagedSandboxWorker(binding);
}

type StartupScope = InstalledSession & { readonly generation: number };

export async function resumeInstalledStartup(
  { store, configuration }: ReconcileContext,
  scope: StartupScope,
): Promise<void> {
  const apiOrigin = configuration.toolOrigin;

  const grant = await store.managed.worker.allocations.resumeStartup({
    ...scope,
    origin: apiOrigin,
    signingKey: configuration.sandbox.bearer,
  });

  if (grant !== null) {
    const { workspaceId, environmentId, sessionId, generation } = scope;

    await startManagedSandboxWorker({
      workspaceId,
      environmentId,
      sessionId,
      generation,
      ...grant,
      apiOrigin,
      sandbox: configuration.sandbox,
    });
  }
}

type ReconcileInput = ReconcileContext & { readonly maxRows: number; readonly dispatchPending: () => Promise<void> };

type ReleaseInput = ReconcileContext & InstalledSession & { readonly generation?: number };

export async function reconcileInstalledRelease({ store, configuration, ...release }: ReleaseInput): Promise<boolean> {
  const allocations = store.managed.worker.allocations;
  const [pending] = await allocations.due({ maxRows: 1, release });

  if (pending !== undefined) {
    await reconcileAllocation({ store, configuration }, pending);

    return true;
  }

  const current = await allocations.status(release);

  if (current?.state !== 'released') {
    return false;
  }

  return release.generation === undefined || release.generation === current.generation;
}

export async function waitForInstalledRelease(input: ReconcileContext & InstalledSession): Promise<boolean> {
  const current = await input.store.managed.worker.allocations.status(input);

  if (current === null || current.state === 'released') {
    return false;
  }

  const target = { ...input, generation: current.generation };

  return await awaitInstalledProgress(() => reconcileInstalledRelease(target));
}

export async function reconcileInstalledAllocations({
  store,
  configuration,
  maxRows,
  dispatchPending,
}: ReconcileInput): Promise<void> {
  const due = await store.managed.worker.allocations.due({ maxRows });

  const results = await Promise.allSettled(
    due.map(async (allocation) => {
      await reconcileAllocation({ store, configuration }, allocation);

      return allocation.action === 'release';
    }),
  );

  if (results.some((result) => result.status === 'fulfilled' && result.value)) {
    await dispatchPending();
  }

  for (const result of results) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
}

import type { ControlStore, InstalledSession } from '@mechane/control-store';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { releaseManagedSandboxWorker, startManagedSandboxWorker, touchManagedSandboxWorker } from '@mechane/runtime';
import type { PluggableSandboxProvider } from '@mechane/sandbox-provider';
import { awaitInstalledProgress } from './await-installed-progress.ts';
import { resolveSandboxBackend } from './provider-dispatch.ts';

const RESTARTABLE_SANDBOX_STATES: ReadonlySet<string> = new Set(['stopped', 'failed']);

type ReconcileContext = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };

type AllocationCheck = InstalledSession & {
  readonly generation: number;
  readonly provider: PluggableSandboxProvider;
  readonly providerSandboxId: string | null;
  readonly snapshotId: string | null;
  readonly action: 'start' | 'touch' | 'release';
};

async function reconcileAllocation({ store, configuration }: ReconcileContext, allocation: AllocationCheck) {
  const backend = resolveSandboxBackend(configuration);

  if (backend.kind === 'none') {
    if (allocation.action === 'release') {
      await store.managed.worker.allocations.confirmRelease(allocation);
    }

    return;
  }

  if (backend.kind === 'adapter') {
    if (allocation.action === 'release') {
      if (allocation.providerSandboxId !== null) {
        const stopped = await backend.adapter.stop({ sandboxId: allocation.providerSandboxId, shouldSnapshot: true });

        if (stopped.snapshotId !== null) {
          await store.managed.worker.allocations.recordSnapshot({ ...allocation, snapshotId: stopped.snapshotId });
        }
      }

      await store.managed.worker.allocations.confirmRelease(allocation);

      return;
    }

    if (allocation.action === 'start' || allocation.providerSandboxId === null) {
      await resumeInstalledStartup({ store, configuration }, allocation);

      return;
    }

    const current = await backend.adapter.status({ sandboxId: allocation.providerSandboxId });

    if (RESTARTABLE_SANDBOX_STATES.has(current.status)) {
      await resumeInstalledStartup({ store, configuration }, allocation);
    }

    return;
  }

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
  const backend = resolveSandboxBackend(configuration);

  if (backend.kind === 'none') {
    return;
  }

  const apiOrigin = configuration.toolOrigin;

  const grant = await store.managed.worker.allocations.resumeStartup({
    ...scope,
    origin: apiOrigin,
    signingKey: configuration.sandbox.bearer,
  });

  if (grant === null) {
    return;
  }

  const { workspaceId, environmentId, sessionId, generation } = scope;

  if (backend.kind === 'adapter') {
    const existing = await store.managed.worker.allocations.status(scope);

    const handle = await backend.adapter.startOrResume({
      workspaceId,
      environmentId,
      sessionId,
      generation,
      workId: grant.workId,
      workSecret: grant.workSecret,
      apiOrigin,
      image: configuration.sandbox.image,
      existingSandboxId: existing?.providerSandboxId ?? null,
      snapshotId: existing?.snapshotId ?? null,
    });

    await store.managed.worker.allocations.recordProviderHandle({
      workspaceId,
      environmentId,
      sessionId,
      generation,
      provider: backend.adapter.kind,
      sandboxId: handle.sandboxId,
    });

    return;
  }

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

export async function destroyExternalSandboxSession({
  store,
  configuration,
  workspaceId,
  environmentId,
  sessionId,
}: ReconcileContext & InstalledSession): Promise<void> {
  const backend = resolveSandboxBackend(configuration);

  if (backend.kind !== 'adapter') {
    return;
  }

  const allocation = await store.managed.worker.allocations.status({ workspaceId, environmentId, sessionId });

  if (allocation?.providerSandboxId !== null && allocation?.providerSandboxId !== undefined) {
    await backend.adapter.destroy({ sandboxId: allocation.providerSandboxId });
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

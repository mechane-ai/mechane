import { isInstalledEnvironment, openControlStore } from '@mechane/control-store';
import type { ControlStore, InstalledSession } from '@mechane/control-store';
import type { ActorNamespace, RuntimeConfiguration } from '@mechane/runtime';
import { Redacted } from 'effect';
import { reportSessionDeliveryFailure } from '../http/failure.ts';
import { getSessionRuntime } from '../managed/session-runtime.ts';
import type { ManagedRequest } from '../managed/types.ts';
import { dispatchInstalledSession } from '../sandboxes/dispatch-installed.ts';
import { reconcileInstalledAllocations } from '../sandboxes/reconcile-installed.ts';
import { finishRecovery } from './finish-recovery.ts';

type OpenStoreInput = { readonly configuration: RuntimeConfiguration };
type DispatchContext = OpenStoreInput & { readonly actors: ActorNamespace };
type WakeInput = DispatchContext & { readonly execution: Pick<ExecutionContext, 'waitUntil'> };
type ReconcileInput = DispatchContext & { readonly store: ControlStore };
const SWEEP_CONCURRENCY = 4;

export async function openServerStore({ configuration }: OpenStoreInput) {
  return await openControlStore({
    databaseUrl: Redacted.value(configuration.databaseUrl),
    keyring: Redacted.value(configuration.credentialKeyring),
    maxConnections: configuration.maxConnections,
  });
}

async function runWithServerStore(
  configuration: RuntimeConfiguration,
  run: (store: ControlStore) => Promise<void>,
): Promise<void> {
  const store = await openServerStore({ configuration });

  try {
    await run(store);
  } finally {
    await store.close();
  }
}

type SessionDelivery = {
  readonly execution: WakeInput['execution'];
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly operation: 'open' | 'dispatch';
  readonly work: Promise<void>;
};

function scheduleDelivery({ execution, work, ...target }: SessionDelivery): void {
  function reportFailure(failure: unknown): void {
    reportSessionDeliveryFailure({ ...target, failure });
  }

  const observed = work.catch(reportFailure);

  try {
    execution.waitUntil(observed);
  } catch (failure) {
    reportFailure(failure);
  }
}

export function installedSessionWake({ configuration, actors, execution }: WakeInput) {
  return (session: InstalledSession): void => {
    if (isInstalledEnvironment(session)) {
      const work = runWithServerStore(configuration, async (store) => {
        const context = { store, configuration, actors };
        const { hasReleasedCapacity } = await dispatchInstalledSession({ ...context, ...session });

        if (hasReleasedCapacity) {
          await dispatchPending(context);
        }
      });

      scheduleDelivery({
        execution,
        workspaceId: session.workspaceId,
        sessionId: session.sessionId,
        operation: 'dispatch',
        work,
      });
    }
  };
}

export function installedCapacityWake({ configuration, actors, execution }: WakeInput) {
  return (): void => {
    execution.waitUntil(
      runWithServerStore(configuration, (store) => dispatchPending({ store, configuration, actors })),
    );
  };
}

export function sessionOpenScheduler(input: WakeInput): ManagedRequest['scheduleSessionOpen'] {
  const { configuration, actors, execution } = input;
  const wakeInstalledSession = installedSessionWake(input);

  return ({ scope, id }) => {
    const work = runWithServerStore(configuration, async (store) => {
      await getSessionRuntime({ store, scope, configuration, actors, wakeInstalledSession }, id);
    });

    scheduleDelivery({ execution, workspaceId: scope.workspaceId, sessionId: id, operation: 'open', work });
  };
}

async function dispatchPending({ store, configuration, actors }: ReconcileInput): Promise<void> {
  const pending = await store.managed.installed.pending({ maxRows: SWEEP_CONCURRENCY });

  await finishRecovery(
    pending.map((session) => ({
      step: session.sessionId,
      work: dispatchInstalledSession({ store, configuration, actors, ...session }),
    })),
  );
}

export async function recoverInstalledSessions(input: ReconcileInput): Promise<void> {
  await finishRecovery([
    {
      step: 'allocated-machines',
      work: reconcileInstalledAllocations({
        ...input,
        maxRows: SWEEP_CONCURRENCY,
        dispatchPending: () => dispatchPending(input),
      }),
    },
    { step: 'pending-work', work: dispatchPending(input) },
  ]);
}

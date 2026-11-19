import type { ControlStore, InstalledSession } from '@mechane/control-store';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { ManagedSandboxResponseError } from '@mechane/runtime';
import type { RuntimeConfiguration } from '@mechane/runtime';
import {
  installedComputerServicePath,
  InstalledDrainReport,
  SandboxReport,
  SandboxStopPhase,
} from '@mechane/sandbox-wire';
import { Option, Redacted, Schema } from 'effect';
import { reconcileInstalledRelease } from './reconcile-installed.ts';

const DRAIN_MAX_ROWS = 8;
type DrainContext = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };
type Allocation = InstalledSession & { readonly generation: number };
type Observation = Pick<InstalledDrainReport['pending'][number], 'phase' | 'reason'>;

async function inspectPendingSave({ sandbox }: RuntimeConfiguration, allocation: Allocation): Promise<Observation> {
  const path = installedComputerServicePath({ ...allocation, resource: 'workspace' });

  const reply = await fetch(new URL(path, sandbox.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${Redacted.value(sandbox.bearer)}` },
    redirect: 'manual',
  });

  if (!reply.ok) {
    await reply.body?.cancel();

    throw new ManagedSandboxResponseError(reply.status);
  }

  const report = await Schema.decodeUnknownPromise(SandboxReport)(await reply.json());
  const recovery = report.environment.recovery;

  if (Option.isSome(recovery)) {
    return { phase: 'failed', reason: `File generation ${recovery.value.generation} requires workspace repair` };
  }

  const stop = report.environment.stop;

  if (Option.isSome(stop)) {
    const { phase, operationId, recoveryAction } = stop.value;

    if (phase === SandboxStopPhase.Failed) {
      return { phase: 'failed', reason: `Stop ${operationId} failed. Recovery action: ${recoveryAction}` };
    }

    if (phase === SandboxStopPhase.WaitingForCommands) {
      return { phase: 'working' };
    }
  }

  return { phase: 'saving' };
}

function allocationKey(allocation: Allocation): string {
  return JSON.stringify([
    allocation.workspaceId,
    allocation.environmentId,
    allocation.sessionId,
    allocation.generation,
  ]);
}

export async function drainInstalledAllocations(context: DrainContext): Promise<InstalledDrainReport> {
  const { installed } = context.store.managed;

  async function page() {
    return await installed.drainInventory({ maxRows: DRAIN_MAX_ROWS });
  }

  const before = await page();

  if (before.pending.length === 0) {
    return { pending: [], hasMore: before.hasMore };
  }

  const observed = new Map<string, Observation>();

  await Promise.all(
    before.pending.map(async (allocation) => {
      // Only the SDK runner knows whether an apparently idle session is still sending a tool result.
      if (allocation.phase === 'working') {
        return;
      }

      if (allocation.phase === 'stopping') {
        await installed.expireUnstarted(allocation);
      }

      try {
        await reconcileInstalledRelease({ ...context, ...allocation });
      } catch (error) {
        if (!(error instanceof ManagedSandboxResponseError && error.status === HttpStatusCode.Unavailable)) {
          throw error;
        }

        observed.set(allocationKey(allocation), await inspectPendingSave(context.configuration, allocation));
      }
    }),
  );

  const current = await page();

  return Schema.decodeUnknownSync(InstalledDrainReport)({
    pending: current.pending.map((entry) => ({ ...entry, ...observed.get(allocationKey(entry)) })),
    hasMore: current.hasMore,
  });
}

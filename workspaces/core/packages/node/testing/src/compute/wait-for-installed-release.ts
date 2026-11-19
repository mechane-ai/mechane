import { SandboxReport, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { ManagedContext } from '../managed-context.ts';
import { waitFor } from '../wait-for.ts';
import { readInstalledComputer } from './read-installed-computer.ts';

type Release = { readonly machineId: string; readonly timeoutMs?: number; readonly afterOperationId?: string };

const SETTLED_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Completed,
  SandboxStopPhase.Failed,
]);

const RELEASE_TIMEOUT_MS = 300_000;

/** Observe the SDK worker's idle exit and the normal control-plane release on this physical machine. */
export async function waitForInstalledRelease(
  context: ManagedContext,
  { machineId, timeoutMs, afterOperationId }: Release,
) {
  const sandbox = context.stack.sandbox;

  if (sandbox === undefined) {
    throw new Error('The scenario requires a local installed computer');
  }

  const report = await waitFor({
    name: 'the installed work lease to settle its filesystem checkpoint',
    timeoutMs: timeoutMs ?? RELEASE_TIMEOUT_MS,
    read: () => readInstalledComputer(context, SandboxReport, { path: '/workspace' }),
    accept: (state) => {
      const stop = Option.getOrNull(state.environment.stop);

      if (stop === null || stop.operationId === afterOperationId) {
        return false;
      }

      return Option.getOrNull(stop.machineId) === machineId && SETTLED_PHASES.has(stop.phase);
    },
  });

  const receipt = Option.getOrThrow(report.environment.stop);
  const machines = await sandbox.readMachines();

  return { report, receipt, isPhysicallyAbsent: !machines.includes(machineId) };
}

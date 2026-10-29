import { SandboxPhase } from '@mechane/protocol';
import { Option } from 'effect';
import { ProcessStatus, TensorlakeStatus } from '../constants.ts';
import { inspectRemote } from '../machines/inspect-remote.ts';
import { readProcess } from '../processes/read-process.ts';
import { readySandboxOrigin } from './ready-sandbox-origin.ts';
import type { MaintenanceInput } from './types.ts';

/** A canceled archive must stop writing shared scratch files before a new operation can replace them. */
export async function archiveSettled({ job, apiKey }: MaintenanceInput): Promise<boolean> {
  if (job.phase !== SandboxPhase.Archive) {
    return true;
  }

  const remote = await inspectRemote({ apiKey, name: job.sourceId });

  if (Option.isNone(remote) || remote.value.status === TensorlakeStatus.Terminated) {
    return true;
  }

  const origin = await readySandboxOrigin({ apiKey, name: job.sourceId });

  if (Option.isNone(origin)) {
    return false;
  }

  const process = await readProcess({ apiKey, origin: origin.value, machineId: `archive-${job.id}` });

  return Option.isNone(process) || process.value.status === ProcessStatus.Exited;
}

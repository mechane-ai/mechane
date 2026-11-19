import { ProcessObservation, SandboxProcessAnswer } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { ManagedContext } from '../managed-context.ts';
import { postInstalledAction } from './managed-process-action.ts';
import { installedComputerResourcePath } from './managed-process-path.ts';

export async function startInstalledProcess(
  context: ManagedContext,
  { command, processId = randomUUID() }: { readonly command: string; readonly processId?: string },
): Promise<ProcessObservation> {
  const result = await postInstalledAction(context, {
    resource: installedComputerResourcePath({ collection: 'processes', id: processId }),
    body: { command },
    schema: SandboxProcessAnswer,
  });

  if (!Schema.is(ProcessObservation)(result)) {
    throw new Error('The installed session refused the process');
  }

  return result;
}

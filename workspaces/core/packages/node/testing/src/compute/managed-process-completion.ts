import { HttpStatusCode } from '@mechane/records';
import { InstalledProcessCompletion } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { ManagedContext } from '../managed-context.ts';
import { waitFor } from '../wait-for.ts';
import { installedComputerResourcePath } from './managed-process-path.ts';
import { requestInstalledComputer } from './request-installed-computer.ts';

export async function waitForInstalledCompletion(context: ManagedContext, processId: string) {
  const response = await waitFor({
    name: 'the installed session to retain the original process completion',
    read: async () => {
      const result = await requestInstalledComputer(context, {
        path: installedComputerResourcePath({ collection: 'completions', id: processId }),
      });

      if (result.status === HttpStatusCode.NotFound) {
        await result.body?.cancel();

        return null;
      }

      if (!result.ok) {
        throw new Error(`Reading the process completion returned HTTP ${result.status}`);
      }

      return Schema.decodeUnknownSync(InstalledProcessCompletion)(await result.json());
    },
    accept: (value) => value !== null,
  });

  if (response === null) {
    throw new Error('The installed process did not produce a completion');
  }

  return response;
}

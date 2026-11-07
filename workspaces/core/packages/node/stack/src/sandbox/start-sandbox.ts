import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Environment } from '../types.ts';
import { startHostLauncher } from './host-launcher.ts';
import { startSandboxProcess } from './runtime-process.ts';

const SANDBOX_CREDENTIAL_BYTES = 32;
const SANDBOX_ENTRY = fileURLToPath(new URL('../../../../worker/sandbox-service/dist/main.js', import.meta.url));
const GUEST_ENTRY = fileURLToPath(new URL('../../../guest/image/guest.mjs', import.meta.url));

type SandboxOptions = {
  readonly directory: string;
  readonly environment: Environment;
  readonly nodeExecutable: string;
  readonly runtimeOrigin: URL;
  readonly workerEntry?: string;
  readonly guestEntry?: string;
};

export type LocalSandbox = { readonly origin: URL; readonly bearer: string; readonly close: () => Promise<void> };

export async function startSandbox(input: SandboxOptions): Promise<LocalSandbox> {
  const workerEntry = input.workerEntry ?? SANDBOX_ENTRY;
  const guestEntry = input.guestEntry ?? GUEST_ENTRY;

  await Promise.all([access(workerEntry), access(guestEntry)]);

  const bearer = randomBytes(SANDBOX_CREDENTIAL_BYTES).toString('hex');

  const launcher = await startHostLauncher({
    directory: join(input.directory, 'machines'),
    guestEntry,
    bearer,
    environment: input.environment,
    nodeExecutable: input.nodeExecutable,
  });

  try {
    const runtime = await startSandboxProcess({
      start: {
        kind: 'start',
        directory: input.directory,
        workerEntry,
        launcherOrigin: launcher.origin.origin,
        runtimeOrigin: input.runtimeOrigin.origin,
        bearer,
      },
      environment: input.environment,
      nodeExecutable: input.nodeExecutable,
    });

    return {
      origin: runtime.origin,
      bearer,
      close: async () => {
        const results = await Promise.allSettled([runtime.close(), launcher.close()]);
        const failures = results.filter((result) => result.status === 'rejected');

        if (failures.length > 0) {
          throw new AggregateError(
            failures.map((failure): unknown => failure.reason),
            'The sandbox fixture did not close',
          );
        }
      },
    };
  } catch (error) {
    await launcher.close();

    throw error;
  }
}

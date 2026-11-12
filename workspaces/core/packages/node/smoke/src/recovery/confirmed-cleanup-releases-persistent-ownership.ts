import { runStackProgram } from '@mechane/stack';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const START_ATTEMPTS = 2;
const MISSING_COMMAND_CODE = 'ENOENT';

export async function confirmedCleanupReleasesPersistentOwnership(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'mechane-stop-retry-'));
  const stateDirectory = join(root, 'state');
  const retainedFile = join(stateDirectory, 'saved-work.txt');
  const retainedText = 'Saved work survives a confirmed cleanup and another startup attempt.';

  await mkdir(stateDirectory);
  await writeFile(retainedFile, retainedText);

  try {
    for (let attempt = 0; attempt < START_ATTEMPTS; attempt += 1) {
      await assert.rejects(
        runStackProgram({
          options: { mode: 'persistent', stateDirectory, environment: { PATH: '' } },
          run: async () => {
            throw new Error('An unavailable prerequisite unexpectedly allowed startup');
          },
        }),
        (cause: unknown) => {
          const failure: { value: unknown } = { value: cause };

          while (failure.value instanceof Error) {
            if ('code' in failure.value && failure.value.code === MISSING_COMMAND_CODE) {
              return true;
            }

            failure.value = failure.value.cause;
          }

          return false;
        },
        'Confirmed cleanup retained an owner lock and prevented another startup attempt',
      );
    }

    assert.equal(await readFile(retainedFile, 'utf8'), retainedText, 'Confirmed cleanup removed saved work');
  } finally {
    await rm(root, { recursive: true });
  }
}

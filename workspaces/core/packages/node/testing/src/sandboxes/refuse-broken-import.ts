import { SandboxReport } from '@mechane/protocol';
import { SandboxOperationId } from '@mechane/records';
import type { Stack } from '@mechane/stack';
import { Effect } from 'effect';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { refusedCli } from '../cli/refused-cli.ts';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { ScenarioFailure } from '../types.ts';

type RefuseBrokenImportInput = { readonly stack: Stack; readonly mech: TalkingMech; readonly folder: string };

/** Leaves a rejected replacement canceled so the caller can prove the previous files still restore. */
export const refuseBrokenImport = Effect.fn('refuseBrokenImport')(function* ({
  stack,
  mech,
  folder,
}: RefuseBrokenImportInput): Effect.fn.Return<void, ScenarioFailure> {
  const file = join(folder, 'invalid.tar.gz');
  const operationId = SandboxOperationId.make(randomUUID());

  yield* Effect.tryPromise({
    try: () => writeFile(file, 'an incomplete archive'),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: file, reason: String(cause) }),
  });

  const args = ['sandbox', 'import', mech.id, '--file', file, '--confirm', '--operation-id', operationId];

  yield* refusedCli({ stack, args, environment: mech.account.environment });
  yield* mech.command({ words: ['sandbox', 'cancel'], ids: ['--operation-id', operationId], result: SandboxReport });
});

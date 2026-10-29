import { finishedProcess } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { FileStep, FileStepFailed } from '@mechane/testing';
import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { INSTALL_TIMEOUT } from './constants.ts';
import type { BinaryReport } from './types.ts';

type BinaryInput = { readonly stack: Stack; readonly binary: string };

/** The line in which an installed binary reports its release, and the SHA-256 of its bytes. */
export const binaryReport = Effect.fn('binaryReport')(function* ({
  stack,
  binary,
}: BinaryInput): Effect.fn.Return<BinaryReport, ScenarioFailure> {
  const run = yield* finishedProcess({
    command: binary,
    args: ['--version'],
    environment: stack.settings.inherited,
    timeout: INSTALL_TIMEOUT,
  });

  const bytes = yield* Effect.tryPromise({
    try: () => readFile(binary),
    catch: (cause) => new FileStepFailed({ step: FileStep.Read, path: binary, reason: String(cause) }),
  });

  return { releaseLine: run.stdout.trim(), sha256: createHash('sha256').update(bytes).digest('hex') };
});

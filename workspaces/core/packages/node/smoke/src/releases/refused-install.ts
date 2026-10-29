import { startProcess } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { FileStep, FileStepFailed } from '@mechane/testing';
import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ScenarioFolder } from './constants.ts';
import { installProcess } from './install-process.ts';
import type { RefusedInstall } from './types.ts';

type RefusedInstallInput = { readonly stack: Stack; readonly folder: string };

/** Runs the install script into a folder of its own: how it exited, and what it left in that folder. */
export const refusedInstall = Effect.fn('refusedInstall')(function* ({
  stack,
  folder,
}: RefusedInstallInput): Effect.fn.Return<RefusedInstall, ScenarioFailure, Scope.Scope> {
  const installFolder = join(folder, ScenarioFolder.RefusedInstall);
  const running = yield* startProcess(installProcess({ stack, folder: installFolder }));
  const { status } = yield* running.exited;

  const left = yield* Effect.tryPromise({
    try: () => readdir(installFolder),
    catch: (cause) => new FileStepFailed({ step: FileStep.List, path: installFolder, reason: String(cause) }),
  });

  return { status, left };
}, Effect.scoped);

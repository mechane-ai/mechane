import { StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DeployStep, TEMPORARY_PREFIX } from './constants.ts';
import { DeployFailed } from './errors.ts';
import type { TemporaryFolderInput } from './types.ts';

/** A fresh folder that only its owner may open, removed with everything in it when the scope closes. */
export function temporaryFolder({ settings }: TemporaryFolderInput): Effect.Effect<string, DeployFailed, Scope.Scope> {
  const prefix = join(settings.temporaryRoot, TEMPORARY_PREFIX);
  const subjects = [StepSubject.cases.Path.make({ path: prefix })];

  return Effect.acquireRelease(
    Effect.tryPromise({
      try: () => mkdtemp(prefix),
      catch: (cause) => new DeployFailed({ step: DeployStep.CreateTemporaryFolder, subjects, reason: String(cause) }),
    }),
    (folder) => Effect.promise(() => rm(folder, { recursive: true, force: true })),
  );
}

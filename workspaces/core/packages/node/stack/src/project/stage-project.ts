import type { LocalSandboxProvider } from '@mechane/deployment';
import { JSON_INDENT_CHARS, StepSubject } from '@mechane/program';
import { baseConfiguration, withBuiltBundle, WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect, Struct } from 'effect';
import { copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StackStep, STAGED_FILES } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackVariables } from '../types.ts';
import { stageVariables } from './stage-variables.ts';
import { stagedContainers } from './staged-containers.ts';

type StagedConfigurationInput = { readonly sandboxProvider: LocalSandboxProvider };

type StageProjectInput = {
  readonly projectFolder: string;
  readonly variables: StackVariables;
  readonly sandboxProvider: LocalSandboxProvider;
};

/** The configuration celld deploys, and the classes its migrations add. */
type StagedConfiguration = {
  readonly staged: Readonly<Record<string, unknown>>;
  readonly durableObjectClasses: ReadonlyArray<string>;
};

/** What the stager wrote: the classes the configuration migrates. */
type StagedProject = { readonly durableObjectClasses: ReadonlyArray<string> };

/**
 * Writes a celld project: the Worker bundle a production build wrote, the Wrangler configuration naming that bundle,
 * and `.dev.vars` with the stack's variables. These override the configuration's, as a deploy's would.
 */
export const stageProject = Effect.fn('stageProject')(function* ({
  projectFolder,
  variables,
  sandboxProvider,
}: StageProjectInput): Effect.fn.Return<StagedProject, StackFailed> {
  const { staged, durableObjectClasses } = yield* stagedConfiguration({ sandboxProvider });
  const bundle = join(projectFolder, STAGED_FILES.bundle);
  const configuration = join(projectFolder, STAGED_FILES.configuration);
  const configurationText = JSON.stringify(staged, null, JSON_INDENT_CHARS);

  const bundleSubjects = [
    StepSubject.cases.Path.make({ path: WORKER_BUNDLE }),
    StepSubject.cases.Path.make({ path: bundle }),
  ];

  const configurationSubjects = [StepSubject.cases.Path.make({ path: configuration })];

  yield* Effect.tryPromise({
    try: () => copyFile(WORKER_BUNDLE, bundle),
    catch: (cause) =>
      new StackFailed({ step: StackStep.CopyWorkerBundle, subjects: bundleSubjects, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => writeFile(configuration, configurationText),
    catch: (cause) =>
      new StackFailed({ step: StackStep.WriteConfiguration, subjects: configurationSubjects, reason: String(cause) }),
  });
  yield* stageVariables({ projectFolder, variables });

  return { durableObjectClasses };
});

/**
 * The configuration celld deploys: Wrangler's, naming the staged bundle, with the containers the sandbox provider
 * stages, and the classes its migrations add.
 */
const stagedConfiguration = Effect.fn('stagedConfiguration')(function* ({
  sandboxProvider,
}: StagedConfigurationInput): Effect.fn.Return<StagedConfiguration, StackFailed> {
  const base = yield* baseConfiguration({ step: StackStep.ReadWranglerConfiguration, failure: StackFailed });

  const configuration = {
    ...Struct.omit(base, ['containers']),
    ...stagedContainers({ sandboxProvider, containers: base.containers }),
  };

  return {
    staged: withBuiltBundle({ configuration, main: STAGED_FILES.bundle }),
    durableObjectClasses: base.migrations.flatMap((migration) => migration.new_sqlite_classes),
  };
});

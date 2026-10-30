import { workerRevision } from '@mechane/program';
import { baseConfiguration, releasesBucket, WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { RuntimeProject, StackSettings } from '../types.ts';

type SourceProjectInput = { readonly settings: StackSettings };

/** Resolves the build outputs and source identity before starting the shared runtime. */
export const sourceProject = Effect.fn('sourceProject')(function* ({
  settings,
}: SourceProjectInput): Effect.fn.Return<RuntimeProject, StackFailed> {
  const configuration = yield* baseConfiguration({ step: StackStep.ReadWranglerConfiguration, failure: StackFailed });
  const bucket = yield* releasesBucket({ configuration, step: StackStep.FindReleasesBucket, failure: StackFailed });

  const revision = yield* workerRevision({
    environment: settings.inherited,
    step: StackStep.ReadWorkerRevision,
    failure: StackFailed,
  });

  return { bundle: WORKER_BUNDLE, configuration, revision, celldCommand: 'celld', releasesBucket: bucket };
});

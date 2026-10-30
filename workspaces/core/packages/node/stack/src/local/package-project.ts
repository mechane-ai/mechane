import { releasesBucket } from '@mechane/wrangler';
import { Effect } from 'effect';
import { join } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { RuntimeProject } from '../types.ts';
import { LOCAL_PACKAGE_FILES } from './constants.ts';
import type { LocalPackage } from './schemas.ts';

type PackageProjectInput = { readonly folder: string; readonly manifest: LocalPackage };

/** Resolves verified package files into the shared celld runtime's startup inputs. */
export const packageProject = Effect.fn('packageProject')(function* ({
  folder,
  manifest,
}: PackageProjectInput): Effect.fn.Return<RuntimeProject, StackFailed> {
  const configuration = manifest.configuration;
  const bucket = yield* releasesBucket({ configuration, step: StackStep.FindReleasesBucket, failure: StackFailed });

  return {
    bundle: join(folder, LOCAL_PACKAGE_FILES.worker),
    configuration,
    revision: manifest.public_commit,
    celldCommand: join(folder, LOCAL_PACKAGE_FILES.celld),
    releasesBucket: bucket,
  };
});

import { DeployFailed, DeployStep, runWrangler, TAG_PREFIX, WRANGLER_READ_TIMEOUT } from '@mechane/deploy-kernel';
import { StepSubject } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { DeploymentAnnotation } from '../constants.ts';
import { WorkerVersion } from './schemas.ts';
import type { VersionTag, VersionTagInput } from './types.ts';

/** The release tag a Worker version was deployed under, as Wrangler reports the version, and the release it names. */
export const versionTag = Effect.fn('versionTag')(function* ({
  settings,
  name,
  versionId,
}: VersionTagInput): Effect.fn.Return<VersionTag, DeployFailed> {
  const subjects = [StepSubject.cases.Version.make({ version: versionId })];

  const viewed = yield* runWrangler({
    args: ['versions', 'view', versionId, '--name', name, '--json'],
    settings,
    credentials: settings.credentials,
    timeout: WRANGLER_READ_TIMEOUT,
  });

  const { annotations } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(WorkerVersion))(viewed).pipe(
    Effect.mapError((error) => new DeployFailed({ step: DeployStep.ReadVersionTag, subjects, reason: error.message })),
  );

  const [, release] = annotations[DeploymentAnnotation.Tag];

  return { tag: `${TAG_PREFIX}${release}`, release };
});

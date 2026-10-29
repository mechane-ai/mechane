import { DeployFailed, DeployStep, RELEASE_TAG } from '@mechane/deploy-kernel';
import type { OperatorModeInput } from '@mechane/deploy-kernel';
import { deployedVersion } from '@mechane/deploy-preflight';
import { writeResult } from '@mechane/program';
import { WORKER_BUNDLE } from '@mechane/wrangler';
import { DateTime, Effect } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * Prints the record of a deploy for its GitHub issue: the tag, the revision, the version the latest deployment serves
 * most, the bundle's SHA-256 and the time, in UTC.
 */
export function writeDeployRecord({ settings, rendered }: OperatorModeInput): Effect.Effect<void, DeployFailed> {
  return Effect.gen(function* () {
    const versionId = yield* deployedVersion({ settings, name: rendered.name });

    const bundle = yield* Effect.tryPromise({
      try: () => readFile(WORKER_BUNDLE),
      catch: (cause) => new DeployFailed({ step: DeployStep.ReadBundle, reason: String(cause) }),
    });

    const deployedAt = yield* DateTime.now;

    for (const line of [
      `worker: ${rendered.name}`,
      `tag: ${RELEASE_TAG}`,
      `revision: ${rendered.revision}`,
      `version: ${versionId}`,
      `bundle sha256: ${createHash('sha256').update(bundle).digest('hex')}`,
      `deployed at: ${DateTime.formatIso(deployedAt)}`,
    ]) {
      writeResult({ line });
    }
  });
}

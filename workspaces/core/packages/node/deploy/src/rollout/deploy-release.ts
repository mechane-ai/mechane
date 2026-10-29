import { RELEASE_TAG } from '@mechane/deploy-kernel';
import type { DeployFailed, OperatorModeInput } from '@mechane/deploy-kernel';
import { runPreflight } from '@mechane/deploy-preflight';
import { RELEASE } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { awaitReadiness } from './await-readiness.ts';
import { checkServed } from './check-served.ts';
import { confirmTag } from './confirm-tag.ts';
import { READINESS_TIMEOUT } from './constants.ts';
import { publishCliRelease } from './publish-cli-release.ts';
import { publishSandboxImage } from './publish-sandbox-image.ts';
import { uploadWorker } from './upload-worker.ts';
import { writeDeployRecord } from './write-deploy-record.ts';

/**
 * Deploys this tagged checkout after the preflight and the operator's typed tag. It waits until readiness reports it,
 * checks what it serves, publishes the CLI's release once the Worker runs it, and prints the deploy's record.
 */
export function deployRelease({ settings, rendered }: OperatorModeInput): Effect.Effect<void, DeployFailed> {
  return Effect.gen(function* () {
    const { origin, deployed } = yield* runPreflight({ settings, rendered });

    const timeout = Option.match(deployed, {
      onNone: () => READINESS_TIMEOUT.first,
      onSome: () => READINESS_TIMEOUT.later,
    });

    yield* confirmTag({ settings, tag: RELEASE_TAG, action: 'deploy' });
    yield* publishSandboxImage({ settings, rendered });
    yield* uploadWorker({ settings, rendered });
    yield* awaitReadiness({
      origin,
      release: RELEASE,
      revision: rendered.revision,
      before: Option.flatMap(deployed, ({ readiness }) => readiness),
      timeout,
    });
    yield* checkServed({ origin });
    yield* publishCliRelease({ settings, rendered });
    yield* writeDeployRecord({ settings, rendered });
  });
}

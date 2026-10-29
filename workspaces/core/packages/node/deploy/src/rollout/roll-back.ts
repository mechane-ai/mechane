import {
  API_ORIGINS,
  checkRefusals,
  DeployStep,
  gitSucceeds,
  productionVariables,
  PROGRAM,
  readJson,
  runGit,
} from '@mechane/deploy-kernel';
import type { DeployFailed } from '@mechane/deploy-kernel';
import { checkCheckout, deployedRelease, readFormats, versionTag } from '@mechane/deploy-preflight';
import { StepSubject, WireKind, writeDiagnostic } from '@mechane/program';
import { Effect, Redacted, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { awaitReadiness } from './await-readiness.ts';
import { confirmTag } from './confirm-tag.ts';
import {
  FULL_TRAFFIC_PERCENTAGE,
  IMAGE_INPUTS,
  PERCENTAGE_STRATEGY,
  READINESS_TIMEOUT,
  RELEASE_FILE,
} from './constants.ts';
import { DeploymentCreated, DeploymentRequest } from './schemas.ts';
import type { RollBackInput, SameFormatsInput, SendTrafficInput } from './types.ts';

/**
 * Returns production to an earlier Worker version, after the operator types its tag, only when that tag and the
 * deployed one share their formats and the image's inputs. Otherwise a patch release rolls forward. The stores, the
 * sandbox image and the latest CLI release never roll back.
 */
export function rollBack({ settings, rendered }: RollBackInput): Effect.Effect<void, DeployFailed> {
  const { versionId, credentials } = settings;

  return Effect.gen(function* () {
    yield* checkCheckout({ settings });

    const { origin } = yield* productionVariables({ rendered });
    const { tag, release } = yield* versionTag({ settings, name: rendered.name, versionId });
    const deployed = yield* deployedRelease({ settings, name: rendered.name, origin });

    yield* checkSameFormats({ settings, target: tag, deployed: deployed.tag });
    writeDiagnostic({ program: PROGRAM, line: `rollback: production runs ${deployed.tag}; ${versionId} runs ${tag}` });
    yield* confirmTag({ settings, tag, action: 'roll back to' });
    yield* sendAllTraffic({
      credentials,
      name: rendered.name,
      versionId,
      message: `roll back from ${deployed.tag} to ${tag}`,
    });
    writeDiagnostic({ program: PROGRAM, line: `rollback: version ${versionId} takes all traffic` });
    yield* awaitReadiness({
      origin,
      release,
      revision: tag,
      before: deployed.readiness,
      timeout: READINESS_TIMEOUT.later,
    });
  });
}

/**
 * Sends all of production's traffic to the version through Cloudflare's API, without `force`. Cloudflare then refuses
 * when a secret changed since that version, rather than bring back an old value. Whenever its input is no terminal,
 * `wrangler rollback` would confirm that change itself.
 */
function sendAllTraffic({
  credentials,
  name,
  versionId,
  message,
}: SendTrafficInput): Effect.Effect<void, DeployFailed> {
  const account = Redacted.value(credentials.cloudflareAccountId);

  const request = {
    strategy: PERCENTAGE_STRATEGY,
    versions: [{ versionId, percentage: FULL_TRAFFIC_PERCENTAGE }],
    annotations: { message },
  } as const;

  // The request is built above to the deployment request's type, so encoding it cannot fail.
  return Schema.encodeEffect(DeploymentRequest)(request).pipe(
    Effect.orDie,
    Effect.flatMap((body) =>
      readJson({
        url: new URL(`${API_ORIGINS.cloudflare}/accounts/${account}/workers/scripts/${name}/deployments`),
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body },
        token: credentials.cloudflareApiToken,
        schema: DeploymentCreated,
        step: DeployStep.SendTraffic,
      }),
    ),
    Effect.asVoid,
  );
}

/**
 * Fails unless two tags' locks hold the same migrations and `/v1` operations, and the tags share what the sandbox image
 * builds from, apart from the release. A rollback leaves the stores and the image as the later release left them.
 */
function checkSameFormats({ settings, target, deployed }: SameFormatsInput): Effect.Effect<void, DeployFailed> {
  return Effect.gen(function* () {
    const before = yield* readFormats({ revision: deployed, settings });
    const after = yield* readFormats({ revision: target, settings });

    // `git diff` passes a path that neither tag has, so each input must first resolve at both.
    for (const revision of [deployed, target]) {
      yield* runGit({ args: ['rev-parse', ...IMAGE_INPUTS.map((path) => `${revision}:./${path}`)], settings });
    }

    const imageComparison = ['diff', '--quiet', deployed, target, '--', ...IMAGE_INPUTS, `:(exclude)${RELEASE_FILE}`];
    const isImageShared = yield* gitSucceeds({ args: imageComparison, settings });

    yield* checkRefusals({
      step: DeployStep.CompareFormats,
      subjects: [StepSubject.cases.Tag.make({ tag: deployed }), StepSubject.cases.Tag.make({ tag: target })],
      refusals: [
        {
          isRefused: !isDeepStrictEqual(before.migrationLock, after.migrationLock),
          reason: 'the Wrangler or store migrations differ',
        },
        {
          isRefused: !isImageShared,
          reason:
            'the guest, a member it bundles, the protocol apart from its release, or the lockfile differs, and the sandbox image builds from them',
        },
        {
          isRefused: !isDeepStrictEqual(before.wireLock[WireKind.Operations], after.wireLock[WireKind.Operations]),
          reason: 'the /v1 operations differ',
        },
      ],
    });
  });
}

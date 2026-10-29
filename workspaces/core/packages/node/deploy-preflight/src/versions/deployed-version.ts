import { DeployFailed, DeployStep, runWrangler, WRANGLER_READ_TIMEOUT } from '@mechane/deploy-kernel';
import type { WorkerVersionId } from '@mechane/deploy-kernel';
import { StepSubject } from '@mechane/program';
import { Array, Effect, Order, Schema } from 'effect';
import { DeploymentList } from './schemas.ts';
import type { DeployedVersionInput } from './types.ts';

/** The version that the Worker's latest deployment, as Wrangler lists them, sends the largest share of traffic. */
export const deployedVersion = Effect.fn('deployedVersion')(function* ({
  settings,
  name,
}: DeployedVersionInput): Effect.fn.Return<WorkerVersionId, DeployFailed> {
  const args = ['deployments', 'list', '--name', name, '--json'];
  const subjects = [StepSubject.cases.Command.make({ args })];

  const listed = yield* runWrangler({
    args,
    settings,
    credentials: settings.credentials,
    timeout: WRANGLER_READ_TIMEOUT,
  });

  const deployments = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(DeploymentList))(listed).pipe(
    Effect.mapError(
      (error) => new DeployFailed({ step: DeployStep.DecodeDeployments, subjects, reason: error.message }),
    ),
  );

  const latest = Array.max(
    deployments,
    Order.mapInput(Order.String, (deployment) => deployment.createdOn),
  );

  return Array.max(
    latest.versions,
    Order.mapInput(Order.Number, (share) => share.percentage),
  ).versionId;
});

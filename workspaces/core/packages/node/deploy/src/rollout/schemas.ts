import { WorkerVersionId } from '@mechane/deploy-kernel';
import { DeploymentAnnotation } from '@mechane/deploy-preflight';
import { Schema } from 'effect';
import { FULL_TRAFFIC_PERCENTAGE, PERCENTAGE_STRATEGY } from './constants.ts';

/**
 * A deployment Cloudflare's API creates, which sends all traffic to one version and describes why. Sent without
 * `force`, Cloudflare refuses it when a secret changed since that version, where `wrangler rollback` off a terminal
 * would confirm for the operator.
 */
export const DeploymentRequest = Schema.fromJsonString(
  Schema.Struct({
    strategy: Schema.Literal(PERCENTAGE_STRATEGY),
    versions: Schema.Tuple([
      Schema.Struct({ versionId: WorkerVersionId, percentage: Schema.Literal(FULL_TRAFFIC_PERCENTAGE) }).pipe(
        Schema.encodeKeys({ versionId: 'version_id' }),
      ),
    ]),
    annotations: Schema.Struct({ message: Schema.String }).pipe(
      Schema.encodeKeys({ message: DeploymentAnnotation.Message }),
    ),
  }),
);

export type DeploymentRequest = typeof DeploymentRequest.Type;

/** Cloudflare's answer to a deployment it created. */
export const DeploymentCreated = Schema.Struct({ success: Schema.Literal(true) });

export type DeploymentCreated = typeof DeploymentCreated.Type;

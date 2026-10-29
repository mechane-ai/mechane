import { ReleaseTag, WorkerVersionId } from '@mechane/deploy-kernel';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { DeploymentAnnotation } from '../constants.ts';

/** A Worker version as `wrangler versions view --json` reports it, read for the release tag it was deployed under. */
export const WorkerVersion = Schema.Struct({ annotations: Schema.Struct({ [DeploymentAnnotation.Tag]: ReleaseTag }) });

export type WorkerVersion = typeof WorkerVersion.Type;

/** The Worker's deployments as `wrangler deployments list --json` reports them, each with its versions' shares. */
export const DeploymentList = Schema.NonEmptyArray(
  wireStruct({
    fields: {
      createdOn: Schema.String,
      versions: Schema.NonEmptyArray(wireStruct({ fields: { versionId: WorkerVersionId, percentage: Schema.Number } })),
    },
  }),
);

export type DeploymentList = typeof DeploymentList.Type;

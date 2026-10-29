import type { OperatorSettings, WorkerVersionId } from '@mechane/deploy-kernel';
import type { Release } from '@mechane/protocol';

export type DeployedReleaseInput = { readonly settings: OperatorSettings; readonly name: string; readonly origin: URL };

export type DeployedVersionInput = { readonly settings: OperatorSettings; readonly name: string };

export type VersionTagInput = {
  readonly settings: OperatorSettings;
  readonly name: string;
  readonly versionId: WorkerVersionId;
};

/** The release tag a Worker version carries, and the release it names. */
export type VersionTag = { readonly tag: string; readonly release: Release };

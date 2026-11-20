import { ArtifactDigest } from '@mechane/program';
import { GitCommit } from '@mechane/records';
import { Schema } from 'effect';
import { QUALIFICATION_FORMAT_VERSION, QUALIFICATION_SHARDS } from '../constants.ts';
import type { QualificationShard } from '../constants.ts';

export const CatalogSummary = Schema.Struct({
  count: Schema.Int.check(Schema.isGreaterThan(0)),
  guarantees: Schema.Array(Schema.NonEmptyString),
});

export type CatalogSummary = typeof CatalogSummary.Type;

export const ShardSummary = Schema.Struct({
  shard: Schema.Literals(QUALIFICATION_SHARDS),
  count: Schema.Int.check(Schema.isGreaterThan(0)),
  guarantees: Schema.Array(Schema.NonEmptyString),
});

export const QualificationTools = Schema.Struct({
  node: Schema.Struct({ ...ArtifactDigest.fields, version: Schema.NonEmptyString }),
  celld: Schema.Struct({ ...ArtifactDigest.fields, version: Schema.NonEmptyString }),
});

export type QualificationTools = typeof QualificationTools.Type;

export type CandidateLog = { readonly name: string; readonly contents: string };

export type CandidateChecks = {
  readonly logs: ReadonlyArray<CandidateLog>;
  readonly catalog: CatalogSummary;
  readonly guestImage: string;
  readonly cli: string;
  readonly tools: QualificationTools;
};

export const ShardReceipt = Schema.Struct({
  format_version: Schema.Literal(QUALIFICATION_FORMAT_VERSION),
  shard: Schema.Literals(QUALIFICATION_SHARDS),
  public_commit: GitCommit,
  artifacts: Schema.Struct({ path: Schema.Literal('artifacts.json'), ...ArtifactDigest.fields }),
  installation: Schema.Struct({ path: Schema.Literal('installation.json'), ...ArtifactDigest.fields }),
  worker_sha256: ArtifactDigest.fields.sha256,
  guest_image: Schema.NonEmptyString,
  guest_image_log: Schema.String,
  cli: Schema.NonEmptyString,
  tools: QualificationTools,
  catalog: CatalogSummary,
  log_file: Schema.NonEmptyString,
  log_sha256: ArtifactDigest.fields.sha256,
});

export type ShardReceipt = typeof ShardReceipt.Type;

type ShardFilenameInput = { readonly shard: QualificationShard };

export function shardReceiptName({ shard }: ShardFilenameInput): string {
  return `qualification-shard-${shard}.json`;
}

export function shardLogName({ shard }: ShardFilenameInput): string {
  return `qualification-shard-${shard}.log`;
}

import { ArtifactDigest, sha256Hex } from '@mechane/program';
import { Release } from '@mechane/protocol';
import { GitCommit } from '@mechane/records';
import { Record, Schema } from 'effect';
import { ASSET_PATTERN, QUALIFICATION_FORMAT_VERSION } from './constants.ts';

export const QUALIFICATION_CHECKS = ['complete', 'artifact-scenarios', 'shipped-formats'] as const;
const QUALIFICATION_INPUT_KINDS = ['toolchain', 'fixtures', 'policy', 'configuration'] as const;

export const QualifiedFile = Schema.Struct({
  path: Schema.String.check(Schema.isPattern(ASSET_PATTERN)),
  ...ArtifactDigest.fields,
});

export type QualifiedFile = typeof QualifiedFile.Type;

const QualifiedInputs = Schema.Array(QualifiedFile).check(
  Schema.makeFilter((files: ReadonlyArray<QualifiedFile>) => files.length > 0, {
    expected: 'at least one exact qualification input',
  }),
);

export const QualificationRequest = Schema.Struct({
  inputs: Schema.Struct({
    toolchain: QualifiedInputs,
    fixtures: QualifiedInputs,
    policy: QualifiedInputs,
    configuration: QualifiedInputs,
  }),
  checks: Schema.Array(
    Schema.Struct({ name: Schema.NonEmptyString, outcome: Schema.Literal('passed'), evidence: QualifiedFile }),
  ),
});

export type QualificationRequest = typeof QualificationRequest.Type;

export const ArtifactQualification = Schema.Struct({
  format_version: Schema.Literal(QUALIFICATION_FORMAT_VERSION),
  version: Release,
  public_commit: GitCommit,
  artifacts: Schema.Struct({ path: Schema.Literal('artifacts.json'), ...ArtifactDigest.fields }),
  installation: Schema.Struct({ path: Schema.Literal('installation.json'), ...ArtifactDigest.fields }),
  ...QualificationRequest.fields,
});

export type ArtifactQualification = typeof ArtifactQualification.Type;

export const QualificationEvidence = Schema.Struct({
  format_version: Schema.Literal(QUALIFICATION_FORMAT_VERSION),
  name: Schema.NonEmptyString,
  outcome: Schema.Literal('passed'),
  public_commit: GitCommit,
  artifacts: ArtifactQualification.fields.artifacts,
  installation: ArtifactQualification.fields.installation,
  inputs_sha256: ArtifactDigest.fields.sha256,
  details: Schema.optionalKey(Schema.Unknown),
});

export type QualificationEvidence = typeof QualificationEvidence.Type;

type QualificationInputsInput = { readonly inputs: QualificationRequest['inputs'] };
type CanonicalFilesInput = { readonly files: ReadonlyArray<QualifiedFile> };

export function qualificationInputDigest({ inputs }: QualificationInputsInput): string {
  const entries = QUALIFICATION_INPUT_KINDS.map((kind) => {
    const files = canonicalFiles({ files: inputs[kind] });

    return [kind, files] as const;
  });

  const canonical = Record.fromEntries(entries);
  const contents = `${JSON.stringify(canonical)}\n`;

  return sha256Hex({ contents });
}

function canonicalFiles({ files }: CanonicalFilesInput): ReadonlyArray<QualifiedFile> {
  const sorted = files.toSorted((left, right) => {
    if (left.path < right.path) {
      return -1;
    }

    if (left.path > right.path) {
      return 1;
    }

    return 0;
  });

  return sorted.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }));
}

type QualificationFilesInput = { readonly qualification: QualificationRequest };

export function qualificationFiles({ qualification }: QualificationFilesInput): ReadonlyArray<QualifiedFile> {
  return [...Record.values(qualification.inputs).flat(), ...qualification.checks.map((check) => check.evidence)];
}

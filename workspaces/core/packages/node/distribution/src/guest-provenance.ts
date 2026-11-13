import { ArtifactDigest } from '@mechane/program';
import { Release } from '@mechane/protocol';
import { GitCommit, SHA256_DIGEST_PATTERN, SHA256_PATTERN } from '@mechane/records';
import { GuestImageInputs } from '@mechane/stack';
import { Schema } from 'effect';

export const GUEST_INPUTS_NAME = 'guest-inputs.json';

const PreviousQualification = Schema.Struct({
  version: Release,
  public_commit: GitCommit,
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
});

export const GuestProvenance = Schema.Struct({
  format_version: Schema.Literal(1),
  inputs: GuestImageInputs,
  guest: Schema.Struct({
    ...ArtifactDigest.fields,
    digest: Schema.String.check(Schema.isPattern(SHA256_DIGEST_PATTERN)),
  }),
  reused_from: Schema.OptionFromNullOr(PreviousQualification),
});

export type GuestProvenance = typeof GuestProvenance.Type;

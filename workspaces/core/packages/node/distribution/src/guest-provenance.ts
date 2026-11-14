import { Release } from '@mechane/protocol';
import { GitCommit, SHA256_PATTERN } from '@mechane/records';
import { GuestImageRecord } from '@mechane/stack';
import { Schema } from 'effect';

export const GUEST_INPUTS_NAME = 'guest-inputs.json';

const PreviousQualification = Schema.Struct({
  version: Release,
  public_commit: GitCommit,
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
});

export const GuestProvenance = Schema.Struct({
  ...GuestImageRecord.fields,
  reused_from: Schema.OptionFromNullOr(PreviousQualification),
});

export type GuestProvenance = typeof GuestProvenance.Type;

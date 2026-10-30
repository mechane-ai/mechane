import { RecordText } from '@mechane/records';
import { Schema } from 'effect';

/** A create-only import found an existing credential and left its value unchanged. */
export class CredentialAlreadyExists extends Schema.TaggedError<CredentialAlreadyExists>()('CredentialAlreadyExists', {
  secretReference: RecordText,
}) {}

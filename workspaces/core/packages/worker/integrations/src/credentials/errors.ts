import { Schema } from 'effect';

/** Crypto and storage failures expose neither their cause nor the held value. */
export class IntegrationSecretInvalid extends Schema.TaggedError<IntegrationSecretInvalid>()(
  'IntegrationSecretInvalid',
  {},
) {}

import { Schema } from 'effect';

/** Operator credentials remain redacted and are isolated by workspace before reference lookup. */
export const IntegrationSecrets = Schema.RedactedFromValue(
  Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.NonEmptyString)),
);

export type IntegrationSecrets = typeof IntegrationSecrets.Type;

/** Deployment accepts one JSON secret map whose contents must never enter persisted agent state. */
export const IntegrationSecretsVariable = Schema.fromJsonString(IntegrationSecrets);
export type IntegrationSecretsVariable = typeof IntegrationSecretsVariable.Type;

import { CredentialValue, IntegrationSecretReference, SlackInstallation, WorkspacePolicy } from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Credential values remain redacted while the private import document's runtime configuration is validated. */
export const WorkspaceImport = wireStruct({
  fields: {
    credentials: Schema.Record(IntegrationSecretReference, CredentialValue),
    slackInstallations: Schema.Array(SlackInstallation),
    /** Absence leaves workspace policy unchanged and requires no installation administrator access. */
    policy: Schema.OptionFromOptionalKey(WorkspacePolicy),
  },
});

export type WorkspaceImport = typeof WorkspaceImport.Type;

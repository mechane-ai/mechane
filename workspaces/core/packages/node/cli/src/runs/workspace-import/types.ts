import type { RunInput } from '@mechane/cli-kernel';
import type { WorkspaceId } from '@mechane/records';
import type { Redacted } from 'effect';
import type { WorkspaceImport } from './schemas.ts';

export type ImportWorkspaceInput = Pick<RunInput<'workspace import'>, 'call'> & {
  readonly token: Redacted.Redacted;
  readonly workspaceId: WorkspaceId;
  readonly document: WorkspaceImport;
  readonly file: string;
};

/** The import reports reference creation without reading or comparing any stored credential value. */
export type CredentialImportResult = { readonly secretReference: string; readonly isCreated: boolean };

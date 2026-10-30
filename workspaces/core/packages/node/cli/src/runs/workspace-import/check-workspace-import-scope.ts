import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import type { ImportWorkspaceInput } from './types.ts';

type CheckWorkspaceImportScopeInput = Pick<ImportWorkspaceInput, 'workspaceId' | 'document' | 'file'>;

/** Rejects repeated or foreign Slack installation identifiers before the import makes any runtime changes. */
export const checkWorkspaceImportScope = Effect.fn('checkWorkspaceImportScope')(function* ({
  workspaceId,
  document,
  file,
}: CheckWorkspaceImportScopeInput): Effect.fn.Return<void, CredentialsFailed> {
  const hasForeignInstallation = document.slackInstallations.some(
    (installation) => installation.workspaceId !== workspaceId,
  );

  const identifiers = document.slackInstallations.map((installation) => installation.id);
  const distinct = new Set(identifiers);
  const hasRepeatedInstallation = distinct.size !== identifiers.length;

  if (hasForeignInstallation || hasRepeatedInstallation) {
    return yield* new CredentialsFailed({
      step: CredentialsStep.Decode,
      path: file,
      reason: 'import Slack installations must have distinct identifiers in the selected workspace',
    });
  }
});

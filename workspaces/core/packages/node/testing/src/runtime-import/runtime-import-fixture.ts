import { SlackInstallation } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { CREDENTIAL_REFERENCE } from '../constants.ts';
import type { FileStepFailed } from '../errors.ts';
import type { WorkspaceAuthorityInput } from '../types.ts';
import { IMPORTED_CREDENTIAL_REFERENCE } from './constants.ts';
import { runtimeImportPolicy } from './runtime-import-policy.ts';
import { writeRuntimeImport } from './write-runtime-import.ts';

type RuntimeImportFixtureInput = WorkspaceAuthorityInput & { readonly installation: SlackInstallation };

/** The proposed replacement differs from the signing key so the next real Slack request detects an overwrite. */
export const runtimeImportFixture = Effect.fn('runtimeImportFixture')(function* ({
  stack,
  workspace,
  installation,
}: RuntimeImportFixtureInput): Effect.fn.Return<ReadonlyArray<string>, FileStepFailed> {
  const unchanged = Schema.encodeSync(SlackInstallation)(installation);

  const policy = runtimeImportPolicy({ workspace, hasSandboxes: true });

  const document = {
    credentials: {
      [CREDENTIAL_REFERENCE]: `${stack.modelUpstream.apiKey}-must-not-replace`,
      [IMPORTED_CREDENTIAL_REFERENCE]: stack.modelUpstream.apiKey,
    },
    slack_installations: [unchanged],
    policy,
  };

  const file = yield* writeRuntimeImport({ account: workspace.owner, document });

  return ['--workspace', workspace.workspaceId, 'workspace', 'import', '--file', file];
});

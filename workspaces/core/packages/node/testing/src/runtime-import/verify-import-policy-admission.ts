import { CredentialList } from '@mechane/protocol';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import { RefusalCode } from '../constants.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { IMPORTED_CREDENTIAL_REFERENCE } from './constants.ts';
import { runtimeImportPolicy } from './runtime-import-policy.ts';
import { writeRuntimeImport } from './write-runtime-import.ts';

type VerifyImportPolicyAdmissionInput = WorkspaceAuthorityInput & { readonly guarantee: string };

/** Policy authorization must precede otherwise valid credential writes by a workspace owner. */
export const verifyImportPolicyAdmission = Effect.fn('verifyImportPolicyAdmission')(function* ({
  stack,
  workspace,
  member,
  guarantee,
}: VerifyImportPolicyAdmissionInput): Effect.fn.Return<void, ScenarioFailure> {
  const policy = runtimeImportPolicy({ workspace, hasSandboxes: true });

  const document = {
    credentials: { [IMPORTED_CREDENTIAL_REFERENCE]: stack.modelUpstream.apiKey },
    slack_installations: [],
    policy,
  };

  const file = yield* writeRuntimeImport({ account: member.account, document });
  const command = { stack, environment: member.account.environment };
  const selection = ['--workspace', member.personalWorkspaceId];
  const refused = yield* refusedCli({ ...command, args: [...selection, 'workspace', 'import', '--file', file] });
  const after = yield* runCli({ ...command, args: [...selection, 'credential', 'list'], result: CredentialList });
  const conditions = [refused.code === RefusalCode.AdministratorRequired, after.result.credentials.length === 0];

  yield* check({
    name: guarantee,
    conditions,
    detail: `runtime import policy preflight ${refused.code}; credentials unchanged`,
  });
});

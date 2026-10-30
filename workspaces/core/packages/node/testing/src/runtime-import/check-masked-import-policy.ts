import { COMMAND_OUTPUTS } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import { RefusalCode } from '../constants.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { runtimeImportPolicy } from './runtime-import-policy.ts';
import { writeRuntimeImport } from './write-runtime-import.ts';

type CheckMaskedImportPolicyInput = WorkspaceAuthorityInput & { readonly guarantee: string };

/** Different saved policies must conflict even when the installation's sandbox switch masks their difference. */
export const checkMaskedImportPolicy = Effect.fn('checkMaskedImportPolicy')(function* ({
  stack,
  workspace,
  guarantee,
}: CheckMaskedImportPolicyInput): Effect.fn.Return<void, ScenarioFailure> {
  const policy = runtimeImportPolicy({ workspace, hasSandboxes: false });
  const document = { credentials: {}, slack_installations: [], policy };
  const file = yield* writeRuntimeImport({ account: workspace.owner, document });
  const args = ['--workspace', workspace.workspaceId, 'workspace', 'import', '--file', file];
  const command = { stack, args, environment: workspace.owner.environment };
  const refused = yield* refusedCli(command);
  const saved = runtimeImportPolicy({ workspace, hasSandboxes: true });

  yield* writeRuntimeImport({ account: workspace.owner, document: { ...document, policy: saved } });

  const repeated = yield* runCli({ ...command, result: COMMAND_OUTPUTS['workspace import'] });
  const conditions = [refused.code === RefusalCode.WorkspacePolicyConflict, repeated.result.hasPolicy];

  yield* check({
    name: guarantee,
    conditions,
    detail: 'policy imports compare saved values while the installation masks sandbox access',
  });
});

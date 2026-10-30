import { WorkspacePolicy } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import type { Account, ScenarioFailure, StackInput } from '../types.ts';

type ChangeWorkspacePolicyInput = StackInput & {
  readonly administrator: Account;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly changes: Partial<WorkspacePolicy>;
};

type PolicyArgumentsInput = { readonly workspaceId: typeof WorkspaceId.Encoded; readonly policy: WorkspacePolicy };

/** Exercise the operator CLI without redeploying or sharing the target workspace's authority. */
export const changeWorkspacePolicy = Effect.fn('changeWorkspacePolicy')(function* ({
  stack,
  administrator,
  workspaceId,
  changes,
}: ChangeWorkspacePolicyInput): Effect.fn.Return<WorkspacePolicy, ScenarioFailure> {
  const environment = administrator.environment;

  const current = yield* runCli({
    stack,
    environment,
    args: ['workspace', 'policy', 'show', workspaceId],
    result: WorkspacePolicy,
  });

  const policy = { ...current.result, ...changes };
  const args = policyArguments({ workspaceId, policy });

  yield* runCli({ stack, environment, args, result: WorkspacePolicy });

  return current.result;
});

function policyArguments({ workspaceId, policy }: PolicyArgumentsInput): ReadonlyArray<string> {
  return [
    'workspace',
    'policy',
    'set',
    workspaceId,
    '--suspended',
    String(policy.isSuspended),
    '--sandboxes',
    String(policy.hasSandboxes),
    '--machines',
    String(policy.machines),
    '--daily-allowance-micros',
    String(policy.dailyAllowanceMicros),
  ];
}

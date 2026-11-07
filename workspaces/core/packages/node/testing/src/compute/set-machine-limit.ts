import { WorkspacePolicy } from '@mechane/protocol';
import type { LocalStack } from '@mechane/stack';
import type { Account } from '../auth/types.ts';
import { runCli } from '../cli/run-cli.ts';

type MachineLimitInput = { readonly stack: LocalStack; readonly account: Account; readonly machines: number };

export async function setMachineLimit({ stack, account, machines }: MachineLimitInput): Promise<void> {
  const policy = await runCli({
    stack,
    account,
    args: ['workspace', 'policy', 'show', account.workspaceId],
    schema: WorkspacePolicy,
  });

  await runCli({
    stack,
    account,
    args: [
      'workspace',
      'policy',
      'set',
      account.workspaceId,
      '--suspended',
      String(policy.isSuspended),
      '--sandboxes',
      String(policy.hasSandboxes),
      '--machines',
      String(machines),
      '--daily-allowance-micros',
      String(policy.dailyAllowanceMicros),
    ],
    schema: WorkspacePolicy,
  });
}

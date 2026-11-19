import { WorkspacePolicy } from '@mechane/protocol';
import type { LocalStack } from '@mechane/stack';
import type { Account } from '../auth/types.ts';
import { runCli } from '../cli/run-cli.ts';

type MachineLimitInput = { readonly stack: LocalStack; readonly account: Account; readonly machines: number };

export async function setMachineLimit({ stack, account, machines }: MachineLimitInput): Promise<void> {
  await setWorkspacePolicy({ stack, account, changes: { machines } });
}

type PolicyChange = Omit<MachineLimitInput, 'machines'> & { readonly changes: Partial<WorkspacePolicy> };

export async function setWorkspacePolicy({ stack, account, changes }: PolicyChange): Promise<WorkspacePolicy> {
  const before = await runCli({
    stack,
    account,
    args: ['workspace', 'policy', 'show', account.workspaceId],
    schema: WorkspacePolicy,
  });

  const policy = { ...before, ...changes };

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
      String(policy.machines),
      '--daily-allowance-micros',
      String(policy.dailyAllowanceMicros),
    ],
    schema: WorkspacePolicy,
  });

  return before;
}

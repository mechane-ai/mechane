import { SandboxReport } from '@mechane/protocol';
import type { LocalStack } from '@mechane/stack';
import type { Account } from '../auth/types.ts';
import { runCli } from '../cli/run-cli.ts';

type DeleteSandboxInput = { readonly stack: LocalStack; readonly account: Account; readonly mechId: string };

export async function deleteSandbox({ stack, account, mechId }: DeleteSandboxInput): Promise<void> {
  await runCli({
    stack,
    account,
    args: ['sandbox', 'delete', mechId, '--workspace', account.workspaceId, '--confirm'],
    schema: SandboxReport,
  });
}

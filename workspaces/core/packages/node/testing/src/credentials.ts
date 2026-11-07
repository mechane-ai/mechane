import { CredentialMetadata } from '@mechane/protocol';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from './cli/run-cli.ts';
import type { AccountContext } from './types.ts';

type CredentialInput = AccountContext & { readonly reference: string; readonly value: string };

export async function installCredential({ stack, account, reference, value }: CredentialInput): Promise<void> {
  const file = join(account.configurationRoot, reference);

  await writeFile(file, value, { mode: 0o600 });
  await runCli({
    stack,
    account,
    args: ['credential', 'put', reference, '--file', file, '--workspace', account.workspaceId],
    schema: CredentialMetadata,
  });
}

import { ExecutionAccessState } from '@mechane/protocol';
import { randomUUID } from 'node:crypto';
import { runCli } from '../cli/run-cli.ts';
import { installCredential } from '../credentials.ts';
import { requireFixtures } from '../fixtures.ts';
import type { MechContext } from '../types.ts';

export async function configureNexusRequests(input: MechContext): Promise<void> {
  const { stack, account, mechId } = input;
  const nexus = requireFixtures(stack).nexus;
  const reference = `nexus-request-${randomUUID()}`;

  await installCredential({ stack, account, reference, value: nexus.apiKey });

  const access = {
    github: null,
    variables: {},
    secrets: {},
    request_service: { service_id: nexus.serviceId, url: nexus.origin.href, secret_reference: reference },
  };

  await runCli({
    stack,
    account,
    args: ['execution-access', 'set', mechId, '--access', JSON.stringify(access), '--workspace', account.workspaceId],
    schema: ExecutionAccessState,
  });
}

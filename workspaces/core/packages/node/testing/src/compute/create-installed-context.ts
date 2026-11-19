import Anthropic from '@anthropic-ai/sdk';
import type { LocalStack } from '@mechane/stack';
import { createAccount } from '../auth/create-account.ts';
import { requireFixtures } from '../fixtures.ts';
import { createManagedContext } from '../managed-context.ts';

export async function createInstalledContext({ stack, name }: { readonly stack: LocalStack; readonly name: string }) {
  const { github } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const client = new Anthropic({ apiKey: account.token, baseURL: stack.origin.origin, maxRetries: 0 });

  for await (const environment of client.beta.environments.list()) {
    if (environment.name === 'Mechane sandbox') {
      return await createManagedContext({
        stack,
        name,
        account,
        environmentId: environment.id,
        agent: {
          tools: [{ type: 'agent_toolset_20260401', default_config: { permission_policy: { type: 'always_allow' } } }],
        },
      });
    }
  }

  throw new Error('The installation did not publish its sandbox environment');
}

import Anthropic from '@anthropic-ai/sdk';
import type { AgentCreateParams } from '@anthropic-ai/sdk/resources/beta/agents';
import type { SessionCreateParams } from '@anthropic-ai/sdk/resources/beta/sessions';
import type { LocalStack } from '@mechane/stack';
import { createAccount } from './auth/create-account.ts';
import type { Account } from './auth/types.ts';
import { requireFixtures } from './fixtures.ts';

type ContextInput = {
  readonly stack: LocalStack;
  readonly name: string;
  readonly account?: Account;
  readonly environmentId?: string;
  readonly session?: Omit<SessionCreateParams, 'agent' | 'environment_id'>;
  readonly agent?: Partial<Omit<AgentCreateParams, 'name'>>;
};

/** Creates an independently addressable session through the same public SDK a self-hosted client uses. */
export async function createManagedContext({
  stack,
  name,
  account,
  environmentId,
  agent: definition,
  session: sessionOptions,
}: ContextInput) {
  const owner = account ?? (await createAccount({ stack, login: requireFixtures(stack).github.users.owner.login }));
  const client = new Anthropic({ baseURL: stack.origin.origin, apiKey: owner.token, maxRetries: 0 });

  async function resolveEnvironment() {
    if (environmentId !== undefined) {
      return await client.beta.environments.retrieve(environmentId);
    }

    return await client.beta.environments.create({ name, config: { type: 'self_hosted' } });
  }

  const environment = await resolveEnvironment();
  const agent = await client.beta.agents.create({ model: 'claude-haiku-5-5', ...definition, name });

  const session = await client.beta.sessions.create({
    ...sessionOptions,
    agent: { type: 'agent', id: agent.id, version: agent.version },
    environment_id: environment.id,
  });

  return { stack, account: owner, client, environment, agent, session };
}

export type ManagedContext = Awaited<ReturnType<typeof createManagedContext>>;

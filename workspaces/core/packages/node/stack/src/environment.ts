import type { StackState } from './state.ts';
import type { Environment, LocalFixtures } from './types.ts';

const FIXTURE_MODEL = 'openai/gpt-6.1-sol';

export const FIXTURE_AUTH_RATE_LIMITS = {
  address: { requests: 1000, windowSeconds: 600 },
  deviceStart: { requests: 1000, windowSeconds: 600 },
  principal: { requests: 1000, windowSeconds: 600 },
  codeAttempt: { requests: 1000, windowSeconds: 600 },
} as const;

const FIXTURE_MODEL_OFFERS = [
  {
    id: FIXTURE_MODEL,
    contextWindowTokens: 32_768,
    maxOutputTokens: 1024,
    inputMicrosPerMillionTokens: 1_000_000,
    outputMicrosPerMillionTokens: 4_000_000,
    cacheReadMicrosPerMillionTokens: 100_000,
    cacheWriteMicrosPerMillionTokens: 1_250_000,
    supportsImages: true,
  },
] as const;

type ServerEnvironmentOptions = {
  readonly inherited: Environment;
  readonly origin: URL;
  readonly databaseUrl: string;
  readonly migrationUrl: string;
  readonly state: StackState;
  readonly fixtures: LocalFixtures | undefined;
};

export function serverEnvironment(input: ServerEnvironmentOptions): Environment {
  const deploymentEnvironment: Record<string, string> = {
    ...input.inherited,
    NODE_ENV: 'production',
    HOST: input.origin.hostname,
    PORT: input.origin.port,
    MECHANE_PUBLIC_ORIGIN: input.origin.origin,
    MECHANE_DATABASE_URL: input.databaseUrl,
    MECHANE_MIGRATION_DATABASE_URL: input.migrationUrl,
    MECHANE_RUNTIME_DATABASE_ROLE: 'mechane_runtime',
    WORKFLOW_POSTGRES_URL: input.databaseUrl,
    MECHANE_CREDENTIAL_KEYRING: input.state.secrets.credentialKeyring,
    MECHANE_BOOTSTRAP_WORKSPACE_ID: input.state.secrets.workspaceId,
    MECHANE_BOOTSTRAP_WORKSPACE_NAME: 'Softmax',
    MECHANE_SANDBOX_ORIGIN: input.inherited['MECHANE_SANDBOX_ORIGIN'] ?? 'http://127.0.0.1:1',
    MECHANE_SANDBOX_KEY: input.inherited['MECHANE_SANDBOX_KEY'] ?? input.state.secrets.sandboxKey,
  };

  if (input.fixtures === undefined) {
    return deploymentEnvironment;
  }

  const { github, model, nexus } = input.fixtures;

  return {
    ...deploymentEnvironment,
    MECHANE_GITHUB_CLIENT_ID: github.clientId,
    MECHANE_GITHUB_CLIENT_SECRET: github.clientSecret,
    MECHANE_GITHUB_WEB_ORIGIN: github.origin.origin,
    MECHANE_GITHUB_API_ORIGIN: github.origin.origin,
    MECHANE_ALLOWED_IDENTITIES: JSON.stringify(
      [github.users.owner, github.users.member].map((user) => ({ provider: 'github', subject: String(user.id) })),
    ),
    MECHANE_ADMINISTRATOR_IDENTITIES: JSON.stringify([{ provider: 'github', subject: String(github.users.owner.id) }]),
    MECHANE_MODEL_UPSTREAM_URL: model.origin.href,
    MECHANE_MODEL_UPSTREAM_KEY: model.apiKey,
    MECHANE_MODEL_OFFERS: JSON.stringify(FIXTURE_MODEL_OFFERS),
    MECHANE_DEFAULT_MODEL: FIXTURE_MODEL,
    MECHANE_NEXUS_EVENT_SECRET: nexus.signingSecret,
    MECHANE_AUTH_RATE_LIMITS: input.inherited['MECHANE_AUTH_RATE_LIMITS'] ?? JSON.stringify(FIXTURE_AUTH_RATE_LIMITS),
    MECHANE_NAMED_KEY_LIFETIME_SECONDS: input.inherited['MECHANE_NAMED_KEY_LIFETIME_SECONDS'] ?? '31536000',
  };
}

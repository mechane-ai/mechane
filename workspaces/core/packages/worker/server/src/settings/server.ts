import { ServiceOrigin } from '@mechane/deployment';
import { RecordId } from '@mechane/records';
import { DEFAULT_AUTH_RATE_LIMITS, KEY_LIFETIME_MAX_SECONDS } from '@mechane/runtime';
import type { AuthenticationConfiguration, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import type { SettingsEnvironment } from './environment.ts';
import { integerSetting, jsonSetting, optionalSetting, requiredSetting } from './environment.ts';

const IdentitySchema = Schema.Struct({ provider: Schema.Literal('github'), subject: Schema.NonEmptyString });
const IdentitiesSchema = Schema.Array(IdentitySchema);
const AllowedIdentitiesSchema = Schema.NullOr(IdentitiesSchema);
const DAY_SECONDS = 86_400;
const DEFAULT_LOGIN_DAYS = 30;
const DEFAULT_NAMED_KEY_DAYS = 365;
const DEFAULT_BOOTSTRAP_NAME = 'Softmax';
const KeyLifetimeSchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: KEY_LIFETIME_MAX_SECONDS }));
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const RateLimitSchema = Schema.Struct({ requests: PositiveInteger, windowSeconds: PositiveInteger });

const RateLimitsSchema = Schema.Struct({
  address: RateLimitSchema,
  deviceStart: RateLimitSchema,
  principal: RateLimitSchema,
  codeAttempt: RateLimitSchema,
});

export type ServerSettings = { readonly isTrustedProxy: boolean; readonly authentication: AuthenticationConfiguration };

type ServerSettingsInput = { readonly runtime: RuntimeConfiguration; readonly environment: SettingsEnvironment };

export function loadServerSettings({ runtime, environment }: ServerSettingsInput): ServerSettings {
  const githubWebOriginSetting = optionalSetting({
    environment,
    name: 'MECHANE_GITHUB_WEB_ORIGIN',
    fallback: 'https://github.com',
  });

  const githubWebOrigin = Schema.decodeUnknownResult(ServiceOrigin)(githubWebOriginSetting);

  if (githubWebOrigin._tag === 'Failure') {
    throw new Error('Invalid server origin MECHANE_GITHUB_WEB_ORIGIN');
  }

  const allowedIdentities = jsonSetting({ environment, name: 'MECHANE_ALLOWED_IDENTITIES', fallback: 'null' });
  const administrators = jsonSetting({ environment, name: 'MECHANE_ADMINISTRATOR_IDENTITIES', fallback: '[]' });

  const rateLimits = jsonSetting({
    environment,
    name: 'MECHANE_AUTH_RATE_LIMITS',
    fallback: JSON.stringify(DEFAULT_AUTH_RATE_LIMITS),
  });

  const bootstrapWorkspaceId = requiredSetting({ environment, name: 'MECHANE_BOOTSTRAP_WORKSPACE_ID' });

  const loginKeyLifetimeSeconds = integerSetting({
    environment,
    name: 'MECHANE_LOGIN_KEY_LIFETIME_SECONDS',
    fallback: DAY_SECONDS * DEFAULT_LOGIN_DAYS,
  });

  const namedKeyLifetimeSeconds = integerSetting({
    environment,
    name: 'MECHANE_NAMED_KEY_LIFETIME_SECONDS',
    fallback: DAY_SECONDS * DEFAULT_NAMED_KEY_DAYS,
  });

  return {
    isTrustedProxy:
      Schema.decodeUnknownSync(Schema.Literals(['true', 'false']))(
        optionalSetting({ environment, name: 'MECHANE_TRUSTED_PROXY', fallback: 'false' }),
      ) === 'true',
    authentication: {
      origin: runtime.publicOrigin,
      githubClientId: requiredSetting({ environment, name: 'MECHANE_GITHUB_CLIENT_ID' }),
      githubClientSecret: requiredSetting({ environment, name: 'MECHANE_GITHUB_CLIENT_SECRET' }),
      githubWebOrigin: githubWebOrigin.success.origin,
      githubApiOrigin: runtime.githubApiOrigin,
      allowedIdentities: Schema.decodeUnknownSync(AllowedIdentitiesSchema)(allowedIdentities),
      administrators: Schema.decodeUnknownSync(IdentitiesSchema)(administrators),
      rateLimits: Schema.decodeUnknownSync(RateLimitsSchema)(rateLimits),
      bootstrapWorkspaceId: Schema.decodeUnknownSync(RecordId)(bootstrapWorkspaceId),
      bootstrapWorkspaceName: optionalSetting({
        environment,
        name: 'MECHANE_BOOTSTRAP_WORKSPACE_NAME',
        fallback: DEFAULT_BOOTSTRAP_NAME,
      }),
      dailyCapMicros: runtime.maxDailyAllowanceMicros,
      loginKeyLifetimeSeconds: Schema.decodeUnknownSync(KeyLifetimeSchema)(loginKeyLifetimeSeconds),
      namedKeyLifetimeSeconds: Schema.decodeUnknownSync(KeyLifetimeSchema)(namedKeyLifetimeSeconds),
    },
  };
}

import { RecordId } from '@mechane/records';
import { DEFAULT_AUTH_RATE_LIMITS, KEY_LIFETIME_MAX_SECONDS } from '@mechane/runtime';
import type { AuthenticationConfiguration, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { integerSetting, jsonSetting, optionalSetting, requiredSetting } from './environment.ts';

const IdentitySchema = Schema.Struct({ provider: Schema.Literal('github'), subject: Schema.NonEmptyString });
const IdentitiesSchema = Schema.Array(IdentitySchema);
const AllowedIdentitiesSchema = Schema.NullOr(IdentitiesSchema);
const DEFAULT_PORT = 8000;
const PORT_MAX = 65_535;
const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const DAY_SECONDS = 86_400;
const DEFAULT_LOGIN_DAYS = 30;
const DEFAULT_NAMED_KEY_DAYS = 365;
const DEFAULT_BOOTSTRAP_NAME = 'Softmax';
const PortSchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: PORT_MAX }));
const KeyLifetimeSchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: KEY_LIFETIME_MAX_SECONDS }));
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const RateLimitSchema = Schema.Struct({ requests: PositiveInteger, windowSeconds: PositiveInteger });

const RateLimitsSchema = Schema.Struct({
  address: RateLimitSchema,
  deviceStart: RateLimitSchema,
  principal: RateLimitSchema,
  codeAttempt: RateLimitSchema,
});

export type ServerSettings = {
  readonly host: string;
  readonly port: number;
  readonly isTrustedProxy: boolean;
  readonly authentication: AuthenticationConfiguration;
};

type ServerSettingsInput = { readonly runtime: RuntimeConfiguration };
type OriginInput = { readonly value: string; readonly name: string };

function originSetting({ value, name }: OriginInput): string {
  const url = new URL(value);
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  const isSecure = url.protocol === 'https:' || (url.protocol === 'http:' && isLocal);
  const hasCredentials = url.username !== '' || url.password !== '';
  const hasResourceParts = url.search !== '' || url.hash !== '' || url.pathname !== '/';

  if (!isSecure || hasCredentials || hasResourceParts) {
    throw new Error(`Invalid server origin ${name}`);
  }

  return value.replace(/\/$/u, '');
}

export function loadServerSettings({ runtime }: ServerSettingsInput): ServerSettings {
  const port = integerSetting({ name: 'PORT', fallback: DEFAULT_PORT });
  const publicOrigin = requiredSetting({ name: 'MECHANE_PUBLIC_ORIGIN' });
  const githubWebOrigin = optionalSetting({ name: 'MECHANE_GITHUB_WEB_ORIGIN', fallback: 'https://github.com' });
  const allowedIdentities = jsonSetting({ name: 'MECHANE_ALLOWED_IDENTITIES', fallback: 'null' });
  const administrators = jsonSetting({ name: 'MECHANE_ADMINISTRATOR_IDENTITIES', fallback: '[]' });

  const rateLimits = jsonSetting({
    name: 'MECHANE_AUTH_RATE_LIMITS',
    fallback: JSON.stringify(DEFAULT_AUTH_RATE_LIMITS),
  });

  const bootstrapWorkspaceId = requiredSetting({ name: 'MECHANE_BOOTSTRAP_WORKSPACE_ID' });

  const loginKeyLifetimeSeconds = integerSetting({
    name: 'MECHANE_LOGIN_KEY_LIFETIME_SECONDS',
    fallback: DAY_SECONDS * DEFAULT_LOGIN_DAYS,
  });

  const namedKeyLifetimeSeconds = integerSetting({
    name: 'MECHANE_NAMED_KEY_LIFETIME_SECONDS',
    fallback: DAY_SECONDS * DEFAULT_NAMED_KEY_DAYS,
  });

  return {
    host: optionalSetting({ name: 'HOST', fallback: '0.0.0.0' }),
    port: Schema.decodeUnknownSync(PortSchema)(port),
    isTrustedProxy:
      Schema.decodeUnknownSync(Schema.Literals(['true', 'false']))(
        optionalSetting({ name: 'MECHANE_TRUSTED_PROXY', fallback: 'false' }),
      ) === 'true',
    authentication: {
      origin: originSetting({ value: publicOrigin, name: 'MECHANE_PUBLIC_ORIGIN' }),
      githubClientId: requiredSetting({ name: 'MECHANE_GITHUB_CLIENT_ID' }),
      githubClientSecret: requiredSetting({ name: 'MECHANE_GITHUB_CLIENT_SECRET' }),
      githubWebOrigin: originSetting({ value: githubWebOrigin, name: 'MECHANE_GITHUB_WEB_ORIGIN' }),
      githubApiOrigin: runtime.githubApiOrigin,
      allowedIdentities: Schema.decodeUnknownSync(AllowedIdentitiesSchema)(allowedIdentities),
      administrators: Schema.decodeUnknownSync(IdentitiesSchema)(administrators),
      rateLimits: Schema.decodeUnknownSync(RateLimitsSchema)(rateLimits),
      bootstrapWorkspaceId: Schema.decodeUnknownSync(RecordId)(bootstrapWorkspaceId),
      bootstrapWorkspaceName: optionalSetting({
        name: 'MECHANE_BOOTSTRAP_WORKSPACE_NAME',
        fallback: DEFAULT_BOOTSTRAP_NAME,
      }),
      dailyCapMicros: runtime.maxDailyAllowanceMicros,
      loginKeyLifetimeSeconds: Schema.decodeUnknownSync(KeyLifetimeSchema)(loginKeyLifetimeSeconds),
      namedKeyLifetimeSeconds: Schema.decodeUnknownSync(KeyLifetimeSchema)(namedKeyLifetimeSeconds),
    },
  };
}

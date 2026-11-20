import type { CredentialKeyring } from '@mechane/control-store';
import { OriginProtocol, SecureOrigin, ServiceOrigin } from '@mechane/deployment';
import { SHA256_PATTERN } from '@mechane/records';
import type { PluggableSandboxProvider } from '@mechane/sandbox-provider';
import { Predicate, Record, Redacted, Schema } from 'effect';
import { readManagedGitSettings } from './managed/git/settings.ts';
import type { ManagedGitSettings } from './managed/git/settings.ts';
import { readManagedMcpSettings } from './managed/mcp/settings.ts';
import type { ManagedMcpSettings } from './managed/mcp/settings.ts';
import { readManagedWebSettings } from './managed/tools/web-settings.ts';
import type { ManagedWebSettings } from './managed/tools/web-settings.ts';
import { gatewayCredentials } from './models/gateway-credential-settings.ts';
import type { GatewayCredentials } from './models/gateway-credential-settings.ts';
import { ManagedEffort } from './models/model-effort.ts';

const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const NonnegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const SecretBinding = Schema.Struct({ get: Schema.declare(Predicate.isFunction) });
const HyperdriveBinding = Schema.Struct({ connectionString: Schema.NonEmptyString });

const TokenRates = Schema.Struct({
  inputMicrosPerMillionTokens: NonnegativeInteger,
  outputMicrosPerMillionTokens: NonnegativeInteger,
  cacheReadMicrosPerMillionTokens: NonnegativeInteger,
  cacheWriteMicrosPerMillionTokens: NonnegativeInteger,
  cacheWriteOneHourMicrosPerMillionTokens: Schema.optionalKey(NonnegativeInteger),
});

const PricedOffer = Schema.Struct({ ...TokenRates.fields, listPrice: Schema.optionalKey(TokenRates) });

const ModelOfferSchema = Schema.Struct({
  ...PricedOffer.fields,
  id: Schema.NonEmptyString,
  contextWindowTokens: PositiveInteger,
  maxOutputTokens: PositiveInteger,
  supportsImages: Schema.optionalKey(Schema.Boolean),
  protocol: Schema.optionalKey(Schema.Literals(['openai-completions', 'anthropic-messages'])),
  efforts: Schema.optionalKey(Schema.NonEmptyArray(ManagedEffort)),
  defaultEffort: Schema.optionalKey(ManagedEffort),
  fastPricing: Schema.optionalKey(PricedOffer),
}).check(
  Schema.makeFilter(
    (offer) => offer.defaultEffort === undefined || offer.efforts?.includes(offer.defaultEffort) === true,
  ),
  Schema.makeFilter((offer) => offer.fastPricing === undefined || offer.protocol === 'anthropic-messages'),
);

const KeyringSchema = Schema.Struct({
  current: Schema.NonEmptyString,
  keys: Schema.Record(Schema.NonEmptyString, Schema.String),
});

const OffersSchema = Schema.NonEmptyArray(ModelOfferSchema);
const DEFAULT_MAX_CONNECTIONS = 8;
const DEFAULT_DAILY_CAP_MICROS = 50_000_000;
const DEFAULT_MAX_MACHINES = 10;
const DEFAULT_SANDBOX_IMAGE = 'ghcr.io/mechane-ai/worker-agent:latest';
const DEFAULT_TENSORLAKE_API_URL = 'https://api.tensorlake.ai';
const DEFAULT_MODAL_APP_NAME = 'mechane-sandboxes';
const DISABLED_SANDBOX_ORIGIN = 'https://sandbox.invalid';
const DISABLED_SANDBOX_BEARER = 'disabled-sandbox-service-key';
const WORKER_IDLE_MIN_MS = 1000;
const WORKER_IDLE_MAX_MS = 3_600_000;

export type ModelOffer = typeof ModelOfferSchema.Type;

export type SandboxRuntimeConfiguration = {
  readonly provider: PluggableSandboxProvider;
  readonly origin: string;
  readonly bearer: Redacted.Redacted;
  readonly image: string;
  readonly workerIdleMs: number | null;
  readonly tensorlake: { readonly apiKey: Redacted.Redacted | null; readonly baseUrl: string };
  readonly modal: {
    readonly baseUrl: string | null;
    readonly bearerToken: Redacted.Redacted | null;
    readonly appName: string;
  };
};

export type RuntimeConfiguration = {
  readonly databaseUrl: Redacted.Redacted;
  readonly credentialKeyring: Redacted.Redacted<CredentialKeyring>;
  readonly maxConnections: number;
  readonly maxDailyAllowanceMicros: number;
  readonly maxMachines: number;
  readonly managedMcp: ManagedMcpSettings;
  readonly managedGit: ManagedGitSettings;
  readonly managedWeb: ManagedWebSettings;
  readonly githubApiOrigin: string;
  readonly publicOrigin: string;
  readonly toolOrigin: string;
  readonly model: {
    readonly upstreamUrl: string;
    readonly credentials: GatewayCredentials;
    readonly offers: ReadonlyArray<ModelOffer>;
  };
  readonly sandbox: SandboxRuntimeConfiguration;
};

export type RuntimeEnvironment = Readonly<Record<string, unknown>>;

const SECRET_SETTINGS = [
  'MECHANE_DATABASE_URL',
  'MECHANE_CREDENTIAL_KEYRING',
  'MECHANE_MODEL_UPSTREAM_KEY',
  'MECHANE_MODEL_ASSERTION_BEARER',
  'MECHANE_SANDBOX_SERVICE_KEY',
  'MECHANE_TENSORLAKE_API_KEY',
  'MECHANE_MODAL_BRIDGE_TOKEN',
  'MECHANE_GITHUB_CLIENT_SECRET',
  'MECHANE_SERVER_API_KEY',
  'MECHANE_AGENT_IDENTITY_PRIVATE_KEY_PEM',
] as const;

export async function resolveRuntimeEnvironment({
  environment,
}: {
  readonly environment: RuntimeEnvironment;
}): Promise<RuntimeEnvironment> {
  const resolved: Record<string, unknown> = { ...environment };

  for (const name of SECRET_SETTINGS) {
    const binding = environment[name];

    if (Schema.is(SecretBinding)(binding)) {
      const secret: unknown = await Reflect.apply(binding.get, binding, []);
      resolved[name] = Schema.decodeUnknownSync(Schema.String)(secret);
    }
  }

  return resolved;
}

function runtimeDatabaseUrl(environment: RuntimeEnvironment): string {
  const hyperdrive = environment['HYPERDRIVE'];

  if (Schema.is(HyperdriveBinding)(hyperdrive)) {
    return hyperdrive.connectionString;
  }

  return requiredEnvironment(environment, 'MECHANE_DATABASE_URL');
}

function requiredEnvironment(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing runtime setting ${name}`);
  }

  return value;
}

function optionalString(environment: RuntimeEnvironment, name: string): string | null {
  const value = environment[name];

  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return value;
}

function serviceOrigin(value: unknown, name: string): URL {
  const decoded = Schema.decodeUnknownResult(ServiceOrigin)(value);

  if (decoded._tag === 'Failure') {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  return decoded.success;
}

function resolveSandboxProvider(environment: RuntimeEnvironment): PluggableSandboxProvider {
  const raw = optionalString(environment, 'MECHANE_SANDBOX_PROVIDER');

  switch (raw) {
    case null:
    case 'cloudflare':
    case 'container':
    case 'host':
      return 'cloudflare';
    case 'docker':
    case 'modal':
    case 'tensorlake':
    case 'none':
      return raw;
    default:
      throw new Error('Invalid runtime setting MECHANE_SANDBOX_PROVIDER');
  }
}

function optionalRedacted(value: string | null): Redacted.Redacted | null {
  if (value === null) {
    return null;
  }

  return Redacted.make(value);
}

function resolveSandboxOrigin(environment: RuntimeEnvironment, provider: PluggableSandboxProvider): string {
  const rawOrigin = optionalString(environment, 'MECHANE_SANDBOX_ORIGIN');

  if (provider === 'cloudflare' || rawOrigin !== null) {
    return serviceOrigin(environment['MECHANE_SANDBOX_ORIGIN'], 'MECHANE_SANDBOX_ORIGIN').origin;
  }

  return DISABLED_SANDBOX_ORIGIN;
}

function resolveSandboxBearer(environment: RuntimeEnvironment, provider: PluggableSandboxProvider): Redacted.Redacted {
  if (provider === 'none') {
    const rawBearer = optionalString(environment, 'MECHANE_SANDBOX_SERVICE_KEY');

    return Redacted.make(rawBearer ?? DISABLED_SANDBOX_BEARER);
  }

  return Redacted.make(requiredEnvironment(environment, 'MECHANE_SANDBOX_SERVICE_KEY'));
}

function resolveTensorlakeSettings(environment: RuntimeEnvironment, provider: PluggableSandboxProvider) {
  const rawUrl = optionalString(environment, 'MECHANE_TENSORLAKE_API_URL');

  const baseUrl: string = (() => {
    if (rawUrl === null) {
      return DEFAULT_TENSORLAKE_API_URL;
    }

    return serviceOrigin(rawUrl, 'MECHANE_TENSORLAKE_API_URL').origin;
  })();

  const rawKey: string | null = (() => {
    if (provider === 'tensorlake') {
      return requiredEnvironment(environment, 'MECHANE_TENSORLAKE_API_KEY');
    }

    return optionalString(environment, 'MECHANE_TENSORLAKE_API_KEY');
  })();

  return { apiKey: optionalRedacted(rawKey), baseUrl };
}

function resolveModalSettings(environment: RuntimeEnvironment, provider: PluggableSandboxProvider) {
  const rawUrl = optionalString(environment, 'MECHANE_MODAL_BRIDGE_URL');

  const baseUrl: string | null = (() => {
    if (provider === 'modal' || rawUrl !== null) {
      return serviceOrigin(environment['MECHANE_MODAL_BRIDGE_URL'], 'MECHANE_MODAL_BRIDGE_URL').origin;
    }

    return null;
  })();

  const rawToken: string | null = (() => {
    if (provider === 'modal') {
      return requiredEnvironment(environment, 'MECHANE_MODAL_BRIDGE_TOKEN');
    }

    return optionalString(environment, 'MECHANE_MODAL_BRIDGE_TOKEN');
  })();

  return {
    baseUrl,
    bearerToken: optionalRedacted(rawToken),
    appName: optionalString(environment, 'MECHANE_MODAL_APP_NAME') ?? DEFAULT_MODAL_APP_NAME,
  };
}

function resolveWorkerIdleMs(environment: RuntimeEnvironment): number | null {
  const value = optionalString(environment, 'MECHANE_SANDBOX_WORKER_IDLE_MS');

  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < WORKER_IDLE_MIN_MS || parsed > WORKER_IDLE_MAX_MS) {
    throw new Error('Invalid runtime setting MECHANE_SANDBOX_WORKER_IDLE_MS');
  }

  return parsed;
}

function loadSandboxConfiguration(environment: RuntimeEnvironment): SandboxRuntimeConfiguration {
  const provider = resolveSandboxProvider(environment);

  const image =
    optionalString(environment, 'MECHANE_SANDBOX_IMAGE') ??
    optionalString(environment, 'MECHANE_CONTAINER_IMAGE') ??
    DEFAULT_SANDBOX_IMAGE;

  return {
    provider,
    origin: resolveSandboxOrigin(environment, provider),
    bearer: resolveSandboxBearer(environment, provider),
    image,
    workerIdleMs: resolveWorkerIdleMs(environment),
    tensorlake: resolveTensorlakeSettings(environment, provider),
    modal: resolveModalSettings(environment, provider),
  };
}

function modelEndpoint(environment: RuntimeEnvironment): string {
  const value = requiredEnvironment(environment, 'MECHANE_MODEL_UPSTREAM_URL');
  const decoded = Schema.decodeUnknownResult(SecureOrigin)(value);

  if (decoded._tag === 'Failure') {
    throw new Error('Invalid runtime setting MECHANE_MODEL_UPSTREAM_URL');
  }

  const url = decoded.success;
  const hasCredentials = url.username !== '' || url.password !== '';

  if (hasCredentials || url.search !== '' || url.hash !== '') {
    throw new Error('Invalid runtime setting MECHANE_MODEL_UPSTREAM_URL');
  }

  return value.replace(/\/$/u, '');
}

function optionalInteger(environment: RuntimeEnvironment, name: string, defaultValue: number): number {
  const value = environment[name];

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid runtime setting ${name}`);
  }

  return parsed;
}

export function loadRuntimeConfiguration({
  environment = process.env,
}: { readonly environment?: RuntimeEnvironment } = {}): RuntimeConfiguration {
  const offers = Schema.decodeUnknownSync(OffersSchema)(
    JSON.parse(requiredEnvironment(environment, 'MECHANE_MODEL_OFFERS')),
  );

  const modelIds = new Set(offers.map((offer) => offer.id));

  if (modelIds.size !== offers.length) {
    throw new Error('Model offers must have distinct IDs');
  }

  const keyring = parseKeyring(environment);

  if (!Object.hasOwn(keyring.keys, keyring.current)) {
    throw new Error('Credential keyring lacks its current key');
  }

  for (const key of Record.values(keyring.keys)) {
    if (!SHA256_PATTERN.test(key.toLowerCase())) {
      throw new Error('Credential keyring contains an invalid key');
    }
  }

  const publicOrigin = serviceOrigin(environment['MECHANE_ORIGIN'], 'MECHANE_ORIGIN');
  const toolOrigin = toolOriginSetting(environment, publicOrigin);

  const githubApiOrigin = serviceOrigin(
    environment['MECHANE_GITHUB_API_ORIGIN'] ?? 'https://api.github.com',
    'MECHANE_GITHUB_API_ORIGIN',
  );

  return {
    databaseUrl: Redacted.make(runtimeDatabaseUrl(environment)),
    credentialKeyring: Redacted.make(keyring),
    maxConnections: optionalInteger(environment, 'MECHANE_DATABASE_MAX_CONNECTIONS', DEFAULT_MAX_CONNECTIONS),
    maxDailyAllowanceMicros: optionalInteger(
      environment,
      'MECHANE_MAX_DAILY_ALLOWANCE_MICROS',
      DEFAULT_DAILY_CAP_MICROS,
    ),
    maxMachines: optionalInteger(environment, 'MECHANE_MAX_MACHINES', DEFAULT_MAX_MACHINES),
    managedMcp: readManagedMcpSettings(environment),
    publicOrigin: publicOrigin.origin,
    toolOrigin: toolOrigin.origin,
    managedGit: readManagedGitSettings(environment),
    managedWeb: readManagedWebSettings(environment),
    githubApiOrigin: githubApiOrigin.origin,
    model: { upstreamUrl: modelEndpoint(environment), credentials: gatewayCredentials(environment), offers },
    sandbox: loadSandboxConfiguration(environment),
  };
}

function parseKeyring(environment: RuntimeEnvironment): CredentialKeyring {
  try {
    return Schema.decodeUnknownSync(KeyringSchema)(
      JSON.parse(requiredEnvironment(environment, 'MECHANE_CREDENTIAL_KEYRING')),
    );
  } catch {
    throw new Error('Credential keyring configuration is invalid');
  }
}

function toolOriginSetting(environment: RuntimeEnvironment, publicOrigin: URL): URL {
  if (environment['MECHANE_TOOL_ORIGIN'] === undefined) {
    return publicOrigin;
  }

  const url = serviceOrigin(environment['MECHANE_TOOL_ORIGIN'], 'MECHANE_TOOL_ORIGIN');

  if (url.protocol !== OriginProtocol.Secure) {
    throw new Error('Invalid runtime setting MECHANE_TOOL_ORIGIN');
  }

  return url;
}

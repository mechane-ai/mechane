import { Option, Result, Schema } from 'effect';
import type { SandboxRuntimeSettings, SecretSource } from '../environment.ts';

type RuntimeSettingsInput = { readonly settings: SandboxRuntimeSettings };
type SecretInput = { readonly source: SecretSource };

const RuntimeTransport = Schema.Struct({ key: Schema.NonEmptyString, secret: Schema.NonEmptyString });
const OptionalRuntimeTransport = Schema.OptionFromNullOr(RuntimeTransport);
const RuntimeTransportJson = Schema.fromJsonString(OptionalRuntimeTransport);
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);
const SERVICE_KEY_MIN_CHARACTERS = 32;
const hasServiceKeyLength = Schema.isMinLength(SERVICE_KEY_MIN_CHARACTERS);
const ServiceKey = Schema.String.check(hasServiceKeyLength);
const MODAL_KEY_HEADER = 'Modal-Key';
const MODAL_SECRET_HEADER = 'Modal-Secret';
const RuntimeProtocol = { Http: 'http:', Https: 'https:' } as const;
const ROOT_PATH = '/';

class RuntimeTransportInvalid extends Schema.TaggedError<RuntimeTransportInvalid>()('RuntimeTransportInvalid', {}) {}

/** Runtime transport is either the authenticated hosted origin or an explicitly configured loopback host. */
export function runtimeOrigin({ settings }: RuntimeSettingsInput): URL {
  const decoded = Schema.decodeUnknownResult(Schema.URLFromString)(settings.origin);
  const origin = Result.getOrThrow(decoded);
  const isLoopback = origin.protocol === RuntimeProtocol.Http && LOOPBACK_HOSTS.has(origin.hostname);

  const isHosted =
    origin.protocol === RuntimeProtocol.Https && origin.hostname.endsWith('.modal.run') && origin.port === '';

  const isBareOrigin = origin.pathname === ROOT_PATH && origin.search === '' && origin.hash === '';
  const hasNoCredentials = origin.username === '' && origin.password === '';
  const isSupportedOrigin = isLoopback || isHosted;

  if (!isSupportedOrigin || !isBareOrigin || !hasNoCredentials) {
    const cause = new RuntimeTransportInvalid({});
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  return origin;
}

/** Loopback needs no outer transport credential; every hosted call requires the configured Modal pair. */
export async function runtimeHeaders({ settings }: RuntimeSettingsInput): Promise<Headers> {
  const origin = runtimeOrigin({ settings });
  const value = await readSecret({ source: settings.transport });
  const decoded = Schema.decodeUnknownResult(RuntimeTransportJson)(value);
  const transport = Result.getOrThrow(decoded);
  const headers = new Headers();

  if (Option.isNone(transport) && origin.protocol === RuntimeProtocol.Http) {
    return headers;
  }

  if (Option.isNone(transport)) {
    const cause = new RuntimeTransportInvalid({});
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  headers.set(MODAL_KEY_HEADER, transport.value.key);
  headers.set(MODAL_SECRET_HEADER, transport.value.secret);

  return headers;
}

/** The private service credential authenticates both directions independently of command credentials. */
export async function sandboxServiceKey({ settings }: RuntimeSettingsInput): Promise<string> {
  const value = await readSecret({ source: settings.serviceKey });
  const decoded = Schema.decodeUnknownResult(ServiceKey)(value);

  return Result.getOrThrow(decoded);
}

async function readSecret({ source }: SecretInput): Promise<string> {
  if (typeof source === 'string') {
    const decoded = Schema.decodeUnknownResult(Schema.NonEmptyString)(source);

    return Result.getOrThrow(decoded);
  }

  const value = await source.get();
  const decoded = Schema.decodeUnknownResult(Schema.NonEmptyString)(value);

  return Result.getOrThrow(decoded);
}

import { SecureOrigin } from '@mechane/deployment';
import { Result, Schema } from 'effect';
import type { SandboxRuntimeSettings, SecretSource } from '../environment.ts';

type RuntimeSettingsInput = { readonly settings: SandboxRuntimeSettings };
type SecretInput = { readonly source: SecretSource };

const SERVICE_KEY_MIN_CHARACTERS = 32;
const hasServiceKeyLength = Schema.isMinLength(SERVICE_KEY_MIN_CHARACTERS);
const ServiceKey = Schema.String.check(hasServiceKeyLength);
const ROOT_PATH = '/';

class RuntimeOriginInvalid extends Schema.TaggedError<RuntimeOriginInvalid>()('RuntimeOriginInvalid', {}) {}

/** Runtime transport is either the authenticated hosted origin or an explicitly configured loopback host. */
export function runtimeOrigin({ settings }: RuntimeSettingsInput): URL {
  const decoded = Schema.decodeUnknownResult(SecureOrigin)(settings.origin);
  const origin = Result.getOrThrow(decoded);
  const hasNoOuterWhitespace = settings.origin.trim() === settings.origin;

  const isBareOrigin = origin.pathname === ROOT_PATH && origin.search === '' && origin.hash === '';
  const hasNoCredentials = origin.username === '' && origin.password === '';

  if (!hasNoOuterWhitespace || !isBareOrigin || !hasNoCredentials) {
    const cause = new RuntimeOriginInvalid({});
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  return origin;
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

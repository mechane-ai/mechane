import { Result, Schema } from 'effect';
import type { SandboxRuntimeSettings, SecretSource } from '../environment.ts';

type RuntimeSettingsInput = { readonly settings: SandboxRuntimeSettings };
type SecretInput = { readonly source: SecretSource };

const SERVICE_KEY_MIN_CHARACTERS = 32;
const hasServiceKeyLength = Schema.isMinLength(SERVICE_KEY_MIN_CHARACTERS);
const ServiceKey = Schema.String.check(hasServiceKeyLength);

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

import { Schema } from 'effect';

export type SettingsEnvironment = Readonly<Record<string, unknown>>;

type RequiredSetting = { readonly name: string; readonly environment: SettingsEnvironment };
type OptionalSetting = RequiredSetting & { readonly fallback: string };
type IntegerSetting = RequiredSetting & { readonly fallback: number };

export function requiredSetting({ name, environment }: RequiredSetting): string {
  return Schema.decodeUnknownSync(Schema.NonEmptyString)(environment[name]);
}

export function optionalSetting({ name, fallback, environment }: OptionalSetting): string {
  return Schema.decodeUnknownSync(Schema.NonEmptyString)(environment[name] ?? fallback);
}

export function integerSetting({ name, fallback, environment }: IntegerSetting): number {
  const value = environment[name];

  if (value === undefined) {
    return fallback;
  }

  const positive = Schema.Int.check(Schema.isGreaterThan(0));

  return Schema.decodeUnknownSync(positive)(Number(value));
}

export function jsonSetting({ name, fallback, environment }: OptionalSetting): unknown {
  const text = optionalSetting({ name, fallback, environment });

  return JSON.parse(text);
}

export function processEnvironment(): SettingsEnvironment {
  return process.env;
}

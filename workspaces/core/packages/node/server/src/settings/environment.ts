import { Schema } from 'effect';

type RequiredSetting = { readonly name: string };
type OptionalSetting = RequiredSetting & { readonly fallback: string };
type IntegerSetting = RequiredSetting & { readonly fallback: number };

export function requiredSetting({ name }: RequiredSetting): string {
  return Schema.decodeUnknownSync(Schema.NonEmptyString)(process.env[name]);
}

export function optionalSetting({ name, fallback }: OptionalSetting): string {
  return Schema.decodeUnknownSync(Schema.NonEmptyString)(process.env[name] ?? fallback);
}

export function integerSetting({ name, fallback }: IntegerSetting): number {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  const positive = Schema.Int.check(Schema.isGreaterThan(0));

  return Schema.decodeUnknownSync(positive)(Number(value));
}

export function jsonSetting({ name, fallback }: OptionalSetting): unknown {
  const text = optionalSetting({ name, fallback });

  return JSON.parse(text);
}

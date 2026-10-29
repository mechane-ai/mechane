import { Result, Schema } from 'effect';
import { SandboxVariables } from './schemas.ts';

class SandboxSettingsInvalid extends Schema.TaggedError<SandboxSettingsInvalid>()('SandboxSettingsInvalid', {
  reason: Schema.String,
}) {}

type ReadSandboxSettingsInput = { readonly variables: unknown };

/** Decodes only the credentials and endpoints required by the selected provider. */
export function readSandboxSettings({ variables }: ReadSandboxSettingsInput): SandboxVariables {
  const decoded = Schema.decodeUnknownResult(SandboxVariables)(variables);
  const checked = Result.mapError(decoded, (cause) => new SandboxSettingsInvalid({ reason: cause.message }));

  return Result.getOrThrow(checked);
}

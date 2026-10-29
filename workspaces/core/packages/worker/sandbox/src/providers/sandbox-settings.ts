import { SandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option, Result, Schema } from 'effect';
import { SandboxVariables } from './schemas.ts';

/** The configured provider variables could not be decoded for this sandbox. */
class SandboxSettingsInvalid extends Schema.TaggedError<SandboxSettingsInvalid>()('SandboxSettingsInvalid', {
  reason: Schema.String,
}) {}

type SandboxSettingsInput = { readonly store: SandboxStore; readonly variables: unknown };

/** A deployment default selects only unbound sandboxes. Existing remote identities always retain Tensorlake. */
export function sandboxSettings({ store, variables }: SandboxSettingsInput): SandboxVariables {
  const state = store.workspace();
  const binding = state.provider;
  const schema = Schema.Record(Schema.String, Schema.Unknown);
  const decoded = Schema.decodeUnknownResult(schema)(variables);
  const checked = Result.mapError(decoded, (cause) => new SandboxSettingsInvalid({ reason: cause.message }));
  const settings = Result.getOrThrow(checked);

  if (Option.isSome(binding)) {
    const bound = { ...settings, [WORKER_VARIABLES.sandboxProvider]: binding.value };

    return readSandboxSettings({ variables: bound });
  }

  const remote = store.remoteSandbox();

  if (Option.isSome(remote)) {
    const bound = { ...settings, [WORKER_VARIABLES.sandboxProvider]: SandboxProvider.Tensorlake };
    const selected = readSandboxSettings({ variables: bound });

    store.bindProvider({ provider: selected.provider });

    return selected;
  }

  const selected = readSandboxSettings({ variables: settings });

  store.bindProvider({ provider: selected.provider });

  return selected;
}

function readSandboxSettings({ variables }: Pick<SandboxSettingsInput, 'variables'>): SandboxVariables {
  const decoded = Schema.decodeUnknownResult(SandboxVariables)(variables);
  const checked = Result.mapError(decoded, (cause) => new SandboxSettingsInvalid({ reason: cause.message }));

  return Result.getOrThrow(checked);
}

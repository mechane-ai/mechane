import { SandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option, Result, Schema } from 'effect';
import { readSandboxSettings } from './read-sandbox-settings.ts';
import type { SandboxVariables } from './schemas.ts';

type SandboxSettingsInput = { readonly store: SandboxStore; readonly variables: unknown };
type SelectedProviderInput = { readonly store: SandboxStore; readonly configured: SandboxVariables };

/** A native workspace retains its provider until verified import commits its replacement. */
export function sandboxSettings({ store, variables }: SandboxSettingsInput): SandboxVariables {
  const schema = Schema.Record(Schema.String, Schema.Unknown);
  const decoded = Schema.decodeUnknownResult(schema)(variables);
  const settings = Result.getOrThrow(decoded);
  const configured = readSandboxSettings({ variables: settings });
  const provider = selectedProvider({ store, configured });

  if (provider === SandboxProvider.Tensorlake && configured.provider !== SandboxProvider.Tensorlake) {
    store.bindProvider({ provider });

    return configured;
  }

  const bound = { ...settings, [WORKER_VARIABLES.sandboxProvider]: provider };
  const selected = readSandboxSettings({ variables: bound });

  store.replaceProvider({ provider });

  return selected;
}

function selectedProvider({ store, configured }: SelectedProviderInput): string {
  const binding = store.workspace().provider;
  const remote = store.remoteSandbox();
  const latest = store.latestMachine();

  if (Option.isSome(remote)) {
    return Option.getOrElse(binding, () => SandboxProvider.Tensorlake);
  }

  if (Option.isNone(latest) && Option.contains(binding, SandboxProvider.Tensorlake)) {
    return configured.provider;
  }

  return Option.getOrElse(binding, () => configured.provider);
}

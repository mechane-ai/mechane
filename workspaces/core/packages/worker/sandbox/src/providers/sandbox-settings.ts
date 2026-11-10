import type { SandboxStore } from '@mechane/sandbox-store';
import type { SandboxEnvironment, SandboxRuntimeSettings } from '../environment.ts';
import { readSandboxSettings } from './read-sandbox-settings.ts';
import type { SandboxVariables } from './schemas.ts';

type SandboxSettingsInput = { readonly store: SandboxStore; readonly environment: SandboxEnvironment };

type SandboxSettings = {
  readonly variables: SandboxVariables;
  readonly workspaceBucket: R2Bucket;
  readonly runtime: SandboxRuntimeSettings;
};

export function sandboxSettings({ store, environment }: SandboxSettingsInput): SandboxSettings {
  const variables = readSandboxSettings({ variables: environment });

  store.replaceProvider({ provider: variables.provider });

  const runtime = sandboxRuntimeSettings({ environment });

  return { variables, workspaceBucket: environment.WORKSPACE_FILES, runtime };
}

/** The only binding read for the runtime callback and public proxy transport. */
export function sandboxRuntimeSettings({
  environment,
}: Pick<SandboxSettingsInput, 'environment'>): SandboxRuntimeSettings {
  return { origin: environment.MECHANE_RUNTIME_ORIGIN, serviceKey: environment.MECHANE_SANDBOX_SERVICE_KEY };
}

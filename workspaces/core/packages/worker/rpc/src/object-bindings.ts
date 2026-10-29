import type { DecodeSettingsInput, ObjectBindings } from './types.ts';

/** The Durable Object namespaces of the environment, which the Worker and the mechs' objects call. */
export function objectBindings({ environment }: DecodeSettingsInput): ObjectBindings {
  return {
    workspaceFiles: environment.WORKSPACE_FILES,
    directory: environment.DIRECTORY,
    workspaces: environment.WORKSPACES,
    mechs: environment.MECHS,
    sandboxes: environment.SANDBOXES,
    limiters: environment.LIMITERS,
    keyCaches: environment.KEY_CACHES,
  };
}

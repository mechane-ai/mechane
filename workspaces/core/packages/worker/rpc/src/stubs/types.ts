import type { Option } from 'effect';

export type MechObjectNameInput = { readonly workspaceId: string; readonly mechId: string };

/** The mech whose sandbox it is, and its drone for a drone's sandbox. */
export type SandboxOwner = MechObjectNameInput & {
  /** The drone whose sandbox it is, none for the mech's own. */
  readonly droneId: Option.Option<string>;
};

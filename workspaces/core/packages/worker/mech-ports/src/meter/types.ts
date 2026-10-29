import type { AbortObject } from '@mechane/harness';
import type { MechStore } from '@mechane/mech-store';
import type { ObjectSettings } from '@mechane/rpc';

/** What the meter of a mech's dispatches works through: its store, its settings, and the reset a lost settle calls. */
export type DispatchMeterInput = {
  readonly store: MechStore;
  readonly settings: ObjectSettings;
  readonly abortObject: AbortObject;
};

/** The workspace whose allowance a dispatch reserves against. */
export type AllowanceInput = { readonly workspaceId: string };

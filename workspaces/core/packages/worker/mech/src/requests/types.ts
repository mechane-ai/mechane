import type { RecordedSignal } from '@mechane/mech-ports';
import type { MechStore } from '@mechane/mech-store';
import type { ObjectSettings } from '@mechane/rpc';
import type { WakeList } from '@mechane/utilities';

export type MechRequestsInput = {
  readonly store: MechStore;
  readonly settings: ObjectSettings;
  readonly signal: WakeList;
  readonly recorded: RecordedSignal;
};

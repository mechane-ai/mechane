import type { StoreContext } from '../context.ts';
import { createSlackAdmissionStore } from './admission.ts';
import { createBindingStore } from './bindings.ts';
import { createChannelConfigurationRecords } from './configuration.ts';
import { createDeliveryStore } from './deliveries.ts';
import { createInstallationStore } from './installations.ts';

type ChannelStore = ReturnType<typeof createInstallationStore> &
  ReturnType<typeof createBindingStore> &
  ReturnType<typeof createDeliveryStore> &
  ReturnType<typeof createChannelConfigurationRecords> &
  ReturnType<typeof createSlackAdmissionStore>;

export function createChannelStore(context: StoreContext): ChannelStore {
  return {
    ...createInstallationStore(context),
    ...createBindingStore(context),
    ...createDeliveryStore(context),
    ...createChannelConfigurationRecords(context),
    ...createSlackAdmissionStore(context),
  };
}

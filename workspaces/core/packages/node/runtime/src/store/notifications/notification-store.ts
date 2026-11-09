import type { StoreContext } from '../context.ts';
import { createNotificationAdmissionStore } from './admission.ts';
import { createActivationCompletionStore } from './completion.ts';
import { createActivationContextStore } from './context.ts';
import { createEnvironmentCheckpointStore } from './environment.ts';
import { createStoredNoteImportStore } from './imported-notes.ts';
import { createActivationReservationStore } from './reservation.ts';
import { createNotificationToolStore } from './tools.ts';

export function createNotificationStore(context: StoreContext) {
  return {
    ...createNotificationAdmissionStore(context),
    ...createActivationReservationStore(context),
    ...createActivationContextStore(context),
    ...createActivationCompletionStore(context),
    ...createNotificationToolStore(context),
    ...createStoredNoteImportStore(context),
    ...createEnvironmentCheckpointStore(context),
  };
}

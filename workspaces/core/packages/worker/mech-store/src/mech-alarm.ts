import { DateTime, Option } from 'effect';
import type { MechAlarm, MechStorageInput } from './types.ts';

type ArmByInput = { readonly storage: DurableObjectStorage; readonly at: DateTime.Utc };

/**
 * The object's one alarm. Its calls stay outside every transaction, since a runtime that waits for a durable wake entry
 * must not do so inside one.
 */
export function mechAlarm({ storage }: MechStorageInput): MechAlarm {
  const arm: MechAlarm['arm'] = async ({ at }) => {
    await storage.setAlarm(DateTime.toEpochMillis(at));
  };

  return { armBy: ({ at }) => armBy({ storage, at }), arm, disarm: () => storage.deleteAlarm() };
}

async function armBy({ storage, at }: ArmByInput): Promise<void> {
  const armed = Option.fromNullishOr(await storage.getAlarm());
  const atMs = DateTime.toEpochMillis(at);

  if (Option.isNone(armed) || armed.value > atMs) {
    await storage.setAlarm(atMs);
  }
}

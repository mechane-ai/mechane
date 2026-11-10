import { serialCalls } from '@mechane/utilities';

type AlarmWrite = { readonly next: () => Promise<number | null> };
type RecoveryAlarm = { readonly at: number };

export function openActorAlarmStore(storage: DurableObjectStorage) {
  const calls = serialCalls();

  async function serialize(change: () => Promise<void>): Promise<void> {
    await calls.run({ run: change });
  }

  return {
    ensureRecovery: async (input: RecoveryAlarm) =>
      await serialize(async () => {
        const current = await storage.getAlarm();

        if (current === null || current > input.at) {
          await storage.setAlarm(input.at);
        }
      }),
    reconcile: async (input: AlarmWrite) =>
      await serialize(async () => {
        const at = await input.next();

        if (at === null) {
          await storage.deleteAlarm();
        } else {
          await storage.setAlarm(at);
        }
      }),
  };
}

export type ActorAlarmStore = ReturnType<typeof openActorAlarmStore>;

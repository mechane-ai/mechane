import { DateTime } from 'effect';
import type { SandboxAlarm, SandboxStoreInput } from './types.ts';

/** The sandbox object's one alarm, which only its store sets, armed and cleared at instants of its storage's clock. */
export function sandboxAlarm({ storage }: SandboxStoreInput): SandboxAlarm {
  const arm: SandboxAlarm['arm'] = async ({ at }) => {
    await storage.setAlarm(DateTime.toEpochMillis(at));
  };

  const disarmAt: SandboxAlarm['disarmAt'] = async ({ at }) => {
    if ((await storage.getAlarm()) === DateTime.toEpochMillis(at)) {
      await storage.deleteAlarm();
    }
  };

  return { arm, disarmAt };
}

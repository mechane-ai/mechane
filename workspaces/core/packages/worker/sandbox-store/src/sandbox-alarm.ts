import { DateTime, Option } from 'effect';
import type { SandboxAlarm, SandboxStoreInput } from './types.ts';

/** The sandbox object's one alarm, which only its store sets, armed and cleared at instants of its storage's clock. */
export function sandboxAlarm({ storage }: SandboxStoreInput): SandboxAlarm {
  const arm: SandboxAlarm['arm'] = async ({ at }) => {
    const requested = DateTime.toEpochMillis(at);

    await storage.transaction(async (transaction) => {
      const current = await transaction.getAlarm();
      const scheduled = Option.fromNullishOr(current);

      if (Option.isNone(scheduled) || requested < scheduled.value) {
        await transaction.setAlarm(requested);
      }
    });
  };

  const disarmAt: SandboxAlarm['disarmAt'] = async ({ at }) => {
    const requested = DateTime.toEpochMillis(at);

    await storage.transaction(async (transaction) => {
      const current = await transaction.getAlarm();

      if (current === requested) {
        await transaction.deleteAlarm();
      }
    });
  };

  const scheduledAt: SandboxAlarm['scheduledAt'] = async () => {
    const at = await storage.getAlarm();
    const scheduled = Option.fromNullishOr(at);

    return Option.map(scheduled, (instant) => DateTime.makeUnsafe(instant));
  };

  return { arm, scheduledAt, disarmAt };
}

import { clearMechStorage } from '@mechane/mech-store';
import { recordForAlarm } from './record-for-alarm.ts';
import type { MechHandle, OpenedMech } from './types.ts';

/** What opens the object's mech, inside the object's concurrency block, and the storage a reopen may empty. */
type MechHandleInput = { readonly open: () => Promise<OpenedMech>; readonly storage: DurableObjectStorage };

/** Whether a reopen deletes the whole database between the close and the open. */
type ReopenInput = { readonly isEmptied: boolean };

/** The open a reopen follows, what it opens again with, and whether it empties the database between. */
type ReopenedMechInput = {
  readonly previous: Promise<OpenedMech>;
  readonly open: () => Promise<OpenedMech>;
  readonly storage: DurableObjectStorage;
  readonly isEmptied: boolean;
};

/**
 * The object's hold on its open mech. A reopen closes pi's Harness, empties the database if asked, and opens the mech
 * again. Every call made after the reopen began waits for the new open, so none reaches the closed Harness.
 */
export function mechHandle({ open, storage }: MechHandleInput): MechHandle {
  const opening = { current: open() };

  const atomic: MechHandle['atomic'] = async ({ run }) => {
    const { store } = await opening.current;

    return await store.atomic({ run });
  };

  const reopenAs: (input: ReopenInput) => Promise<void> = async ({ isEmptied }) => {
    opening.current = reopenedMech({ previous: opening.current, open, storage, isEmptied });

    await opening.current;
  };

  return {
    current: () => opening.current,
    atomic,
    recordForAlarm: ({ run }) => recordForAlarm({ opened: opening.current, run }),
    reopen: () => reopenAs({ isEmptied: false }),
    reopenEmpty: () => reopenAs({ isEmptied: true }),
  };
}

/** The mech opened again once the open before it closed pi's Harness, on an emptied database if asked. */
async function reopenedMech({ previous, open, storage, isEmptied }: ReopenedMechInput): Promise<OpenedMech> {
  const { harness } = await previous;

  await harness.release();

  if (isEmptied) {
    await clearMechStorage({ storage });
  }

  return await open();
}

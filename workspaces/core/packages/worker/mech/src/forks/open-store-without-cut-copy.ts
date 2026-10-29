import { clearMechStorage, openMechStore } from '@mechane/mech-store';
import type { MechStore, OpenMechStoreInput } from '@mechane/mech-store';
import { Option } from 'effect';

/**
 * Opens the mech's own tables. A copy cut off before its end leaves part of its parent's rows, which pi must never open
 * on, so the object deletes its whole database and opens empty. The parent's next fork call copies into it again.
 */
export async function openStoreWithoutCutCopy({ storage, transaction }: OpenMechStoreInput): Promise<MechStore> {
  const store = await openMechStore({ storage, transaction });

  if (Option.isNone(await store.atomic({ run: (tables) => tables.copy() }))) {
    return store;
  }

  await clearMechStorage({ storage });

  return await openMechStore({ storage, transaction });
}

import type { MechTables } from '@mechane/mech-store';
import { Option } from 'effect';
import type { OpenedMech } from '../../types.ts';

type SourceIsBusyInput = { readonly mech: OpenedMech };

/** Publication captures only an idle mech's workspace. */
export async function sourceIsBusy({ mech }: SourceIsBusyInput): Promise<boolean> {
  const run: (store: MechTables) => boolean = (store) => {
    const running = store.runningTurn();
    const pending = store.pendingInboxItems();

    return Option.isSome(running) || pending.length > 0;
  };

  return await mech.store.atomic({ run });
}

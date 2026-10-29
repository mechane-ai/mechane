import type { MechRow, MechTables } from '@mechane/mech-store';
import { EventType } from '@mechane/protocol';
import { MechRecord } from '@mechane/rpc';
import type { ForkedMech } from '@mechane/rpc';
import { DateTime, Option, Schema } from 'effect';
import type { MechHandle } from '../types.ts';

/** The object's hold on its open mech, and the fork's mech that the copy's end creates. */
type EndReceivedCopyInput = { readonly handle: MechHandle; readonly mech: ForkedMech };

/**
 * Creates the mech, records `mech.forked` after the events it copied and unmarks the copy in one transaction. Then it
 * opens pi anew on the copy and gives its conversation a provider session id of its own.
 */
export async function endReceivedCopy({ handle, mech }: EndReceivedCopyInput): Promise<void> {
  const { workspaceId, forkedFrom } = mech;
  const received = Schema.decodeUnknownSync(MechRecord)(mech);
  const created: MechRow = { ...received, workspaceId, forkedFrom: Option.some(forkedFrom) };
  const now = DateTime.nowUnsafe();

  const create: (tables: MechTables) => void = (tables) => {
    tables.createMech({ mech: created });
    tables.appendEvent({ event: { type: EventType.MechForked, forkedFrom }, now });
    tables.endCopy();
  };

  await handle.atomic({ run: create });
  await handle.reopen();

  const { harness } = await handle.current();

  await harness.renewProvider();
}

import type { MechTables } from '@mechane/mech-store';
import type { CopyRows } from '@mechane/records';
import type { CopyStep } from '@mechane/rpc';
import { DateTime, Match } from 'effect';
import type { MechHandle } from '../types.ts';
import { endReceivedCopy } from './end-received-copy.ts';

/** One step of a copy, and the object's hold on its open mech. */
type ReceiveCopyInput = { readonly handle: MechHandle; readonly step: CopyStep };

/** A page of a table's rows that a copy moves. */
type CopyRowsStep = { readonly page: CopyRows<SqlStorageValue> };

/** The object's hold on its open mech, which a copy's begin reopens empty. */
type BeginReceivedCopyInput = Pick<ReceiveCopyInput, 'handle'>;

/**
 * Applies one step of a fork's copy to the new mech's object: its begin, a page of its rows, or its end. The parent
 * records the copy only once the end answered, so a fork cut off before then copies again from the begin.
 */
export async function receiveCopy({ handle, step }: ReceiveCopyInput): Promise<void> {
  const writeRows: (rows: CopyRowsStep) => Promise<void> = async ({ page }) => {
    await handle.atomic({ run: (tables) => tables.writeCopyRows(page) });
  };

  await Match.valueTags(step, {
    Begin: async () => await beginReceivedCopy({ handle }),
    Rows: writeRows,
    End: async ({ mech }) => await endReceivedCopy({ handle, mech }),
  });
}

/**
 * Closes pi, deletes the whole database and opens it empty, so a copy that starts again keeps no row of one cut off,
 * then marks the copy.
 */
async function beginReceivedCopy({ handle }: BeginReceivedCopyInput): Promise<void> {
  await handle.reopenEmpty();

  const now = DateTime.nowUnsafe();
  const begin: (tables: MechTables) => void = (tables) => tables.beginCopy({ now });

  await handle.atomic({ run: begin });
}

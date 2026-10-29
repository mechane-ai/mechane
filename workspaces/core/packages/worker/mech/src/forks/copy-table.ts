import type { MechRpc } from '@mechane/rpc';
import { Option } from 'effect';
import type { OpenedMech } from '../types.ts';

/** The open mech, the new mech's object a copy moves its rows to, and the table it moves. */
type CopyTableInput = { readonly mech: OpenedMech; readonly fork: DurableObjectStub<MechRpc>; readonly table: string };

/** A table's page to move: the copy's mech, its new object and table, and the last rowid the page before it moved. */
type CopyTablePageInput = CopyTableInput & { readonly afterRowid: number };

/** The rowid a table's first page starts after: SQLite numbers a table's rows from 1. */
const FIRST_ROWID = 0;

/** Moves one table to the fork a page at a time, each page after the last row the page before it moved. */
export async function copyTable({ mech, fork, table }: CopyTableInput): Promise<void> {
  let next = Option.some(FIRST_ROWID);

  while (Option.isSome(next)) {
    next = await copyTablePage({ mech, fork, table, afterRowid: next.value });
  }
}

/** Moves one page of the table to the fork, and answers the rowid the next page starts after, none after the last. */
async function copyTablePage({ mech, fork, table, afterRowid }: CopyTablePageInput): Promise<Option.Option<number>> {
  const { next, ...page } = await mech.store.atomic({ run: (tables) => tables.copyPage({ table, afterRowid }) });

  await fork.receiveCopy({ step: { _tag: 'Rows', page } });

  return next;
}

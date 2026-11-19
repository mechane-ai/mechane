import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ActorPage, ActorPageInput, ActorRoutine } from '../actor/client.ts';
import { Routines } from '../actor/collections.ts';
import type { ActorRecordReader } from '../actor/record-store.ts';
import { decodeStored, RoutineRecord } from '../actor/records.ts';

const ROUTINE_PAGE_MAX_ROWS = 50;
type RoutineView = { readonly harness: ActorRecordReader };

export async function readRoutine(
  access: RoutineView,
  input: { readonly routineId: string },
): Promise<ActorRoutine | null> {
  const row = await Routines.get(access.harness, input.routineId, BACKGROUND_CONTEXT);

  if (row === undefined) {
    return null;
  }

  return decodeStored(RoutineRecord, row.value);
}

export async function listRoutines(access: RoutineView, input: ActorPageInput): Promise<ActorPage<ActorRoutine>> {
  const page = await Routines.page(
    access.harness,
    { after: input.after ?? undefined, maxRows: ROUTINE_PAGE_MAX_ROWS },
    BACKGROUND_CONTEXT,
  );

  return { items: page.items.map((row) => decodeStored(RoutineRecord, row.value)), hasMore: page.hasMore };
}

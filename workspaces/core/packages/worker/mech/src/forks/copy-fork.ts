import { mechStub } from '@mechane/rpc';
import type { ForkedMech } from '@mechane/rpc';
import { copyTable } from './copy-table.ts';
import type { OpenedInput } from './types.ts';

/** The open mech, and the new mech it copies itself into. */
type CopyForkInput = OpenedInput & { readonly forked: ForkedMech };

/**
 * Empties the new mech's object, moves every table to it page by page, and ends the copy there with the new mech's row.
 * It then records that the new mech holds the copy. Each step repeats safely, and the copy starts again from an empty
 * object.
 */
export async function copyFork({ mech, forked }: CopyForkInput): Promise<void> {
  const fork = mechStub({ bindings: mech.settings, workspaceId: forked.workspaceId, mechId: forked.id });

  await fork.receiveCopy({ step: { _tag: 'Begin' } });

  for (const table of await mech.store.atomic({ run: (tables) => tables.copiedTables() })) {
    await copyTable({ mech, fork, table });
  }

  await fork.receiveCopy({ step: { _tag: 'End', mech: forked } });
  await mech.store.atomic({
    run: (tables) => tables.recordCopy({ forkId: forked.id, sequence: forked.forkedFrom.sequence }),
  });
}

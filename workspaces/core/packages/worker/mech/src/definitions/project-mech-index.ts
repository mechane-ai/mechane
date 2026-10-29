import { MechSummaryRecord, workspaceStub } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import type { OpenedMech } from '../types.ts';

type ProjectMechIndexInput = Pick<OpenedMech, 'store' | 'settings'>;

/**
 * Projects a pending saved revision into the workspace roster before marking that revision indexed. A failed call or a
 * concurrent later revision leaves work for the next catch-up.
 */
export async function projectMechIndex({ store, settings }: ProjectMechIndexInput): Promise<void> {
  const pending = await store.atomic({ run: (tables) => tables.pendingMechIndex() });

  if (Option.isNone(pending)) {
    return;
  }

  const mech = pending.value;
  const entry = Schema.encodeSync(MechSummaryRecord)(mech);

  await workspaceStub({ bindings: settings, workspaceId: mech.workspaceId }).indexMech({ mech: entry });
  await store.atomic({ run: (tables) => tables.markMechIndexed({ revision: mech.revision }) });
}

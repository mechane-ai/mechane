import { Schema } from 'effect';
import { requireWorkspaceMech } from './api/configuration/authority.ts';
import { createWorkspaceRecords } from './api/configuration/workspaces.ts';
import type { StoreContext } from './context.ts';
import { StoreConflict } from './errors.ts';
import { lockWorkspace } from './scope-locks.ts';

type CapacityIdentity = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly reservationId: number;
  readonly machineId: string;
};

type CapacityAcquisition =
  | { readonly status: 'acquired' }
  | { readonly status: 'refused'; readonly reason: 'disabled' | 'capacity' | 'stale' };

type CapacityRelease = { readonly status: 'released' } | { readonly status: 'refused'; readonly reason: 'stale' };

const AllocationSchema = Schema.Struct({
  reservation_id: Schema.Number,
  machine_id: Schema.String,
  state: Schema.Literals(['held', 'released']),
});

const HeldMachinesSchema = Schema.Struct({ held_machines: Schema.Number });
type Allocation = typeof AllocationSchema.Type;

export function createSandboxCapacityStore(context: StoreContext) {
  return {
    async acquireSandboxCapacity(identity: CapacityIdentity): Promise<CapacityAcquisition> {
      validateReservation(identity.reservationId);

      return await context.atomic(async (transaction) => {
        await lockCapacityScope(transaction, identity);

        const policy = await createWorkspaceRecords(transaction).getRuntimePolicy(identity);

        if (policy === null) {
          return { status: 'refused', reason: 'disabled' };
        }

        if (policy.isSuspended || !policy.hasSandboxes || policy.machines <= 0) {
          return { status: 'refused', reason: 'disabled' };
        }

        const previous = await readAllocation(transaction, identity);

        if (isStaleReservation(identity, previous)) {
          return { status: 'refused', reason: 'stale' };
        }

        if (previous !== null) {
          if (identity.reservationId === previous.reservation_id) {
            if (previous.state !== 'held') {
              return { status: 'refused', reason: 'stale' };
            }

            return { status: 'acquired' };
          }

          if (previous.state === 'held') {
            return { status: 'refused', reason: 'capacity' };
          }
        }

        const counted = await transaction.client.query(
          "SELECT count(*) AS held_machines FROM mechane.sandbox_capacity WHERE workspace_id=$1 AND state='held'",
          [identity.workspaceId],
        );

        const allocation = Schema.decodeUnknownSync(HeldMachinesSchema)(counted.rows[0]);

        if (allocation.held_machines >= policy.machines) {
          return { status: 'refused', reason: 'capacity' };
        }

        await saveAllocation(transaction, identity, 'held');

        return { status: 'acquired' };
      });
    },
    async releaseSandboxCapacity(identity: CapacityIdentity): Promise<CapacityRelease> {
      validateReservation(identity.reservationId);

      return await context.atomic(async (transaction) => {
        await lockCapacityScope(transaction, identity);

        const previous = await readAllocation(transaction, identity);

        if (isStaleReservation(identity, previous)) {
          return { status: 'refused', reason: 'stale' };
        }

        const isReplacingHeld = previous?.state === 'held' && identity.reservationId > previous.reservation_id;

        if (isReplacingHeld) {
          return { status: 'refused', reason: 'stale' };
        }

        await saveAllocation(transaction, identity, 'released');

        return { status: 'released' };
      });
    },
  };
}

function validateReservation(reservationId: number): void {
  if (!Number.isSafeInteger(reservationId) || reservationId < 1) {
    throw new StoreConflict('Sandbox reservation must be a positive safe integer');
  }
}

async function readAllocation(context: StoreContext, identity: CapacityIdentity): Promise<Allocation | null> {
  const found = await context.client.query(
    'SELECT reservation_id,machine_id,state FROM mechane.sandbox_capacity WHERE workspace_id=$1 AND mech_id=$2',
    [identity.workspaceId, identity.mechId],
  );

  if (found.rows.length === 0) {
    return null;
  }

  return Schema.decodeUnknownSync(AllocationSchema)(found.rows[0]);
}

async function saveAllocation(
  context: StoreContext,
  identity: CapacityIdentity,
  state: Allocation['state'],
): Promise<void> {
  await context.client.query(
    `INSERT INTO mechane.sandbox_capacity(workspace_id,mech_id,reservation_id,machine_id,state)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(mech_id) DO UPDATE SET
       reservation_id=EXCLUDED.reservation_id,machine_id=EXCLUDED.machine_id,state=EXCLUDED.state
     WHERE mechane.sandbox_capacity.workspace_id=EXCLUDED.workspace_id`,
    [identity.workspaceId, identity.mechId, identity.reservationId, identity.machineId, state],
  );
}

async function lockCapacityScope(context: StoreContext, identity: CapacityIdentity): Promise<void> {
  await lockWorkspace({ client: context.client, workspaceId: identity.workspaceId });
  await requireWorkspaceMech({ context, ...identity });
}

function isStaleReservation(identity: CapacityIdentity, previous: Allocation | null): boolean {
  if (previous === null) {
    return false;
  }

  if (identity.reservationId < previous.reservation_id) {
    return true;
  }

  return identity.reservationId === previous.reservation_id && identity.machineId !== previous.machine_id;
}

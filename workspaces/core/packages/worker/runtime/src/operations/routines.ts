import type { ControlStore } from '@mechane/control-store';
import { catalog, RequestInvalid } from '@mechane/protocol';
import { Option } from 'effect';
import type { ActorRoutine, MechActorResolver, MechScope } from '../actor/client.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import type { AuthCaller } from './types.ts';
import { requireAuthenticated, validatedOperation } from './validated-operation.ts';

type RoutineOperationsInput = { readonly store: ControlStore; readonly actors: MechActorResolver };

export function createRoutineOperations({ store, actors }: RoutineOperationsInput) {
  async function requireMech(caller: AuthCaller, input: MechScope) {
    const authenticated = requireAuthenticated(caller);

    await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });
    await store.getMech(input);

    return { actor: actors(input), principalId: authenticated.principalId };
  }

  return {
    putRoutine: validatedOperation({
      operation: catalog.putRoutine,
      run: async ({ input, caller }) => {
        const { actor, principalId } = await requireMech(caller, input);
        const routine = await actor.putRoutine({ ...input, principalId });

        return routineWire(routine);
      },
    }),
    showRoutine: validatedOperation({
      operation: catalog.showRoutine,
      run: async ({ input, caller }) => {
        const { actor } = await requireMech(caller, input);
        const routine = await actor.readRoutine(input);

        if (routine === null) {
          throw new RequestInvalid({ reason: 'The routine does not exist for this mech' });
        }

        return routineWire(routine);
      },
    }),
    listRoutines: validatedOperation({
      operation: catalog.listRoutines,
      run: async ({ input, caller }) => {
        const { actor } = await requireMech(caller, input);
        const page = await actor.listRoutines({ after: Option.getOrNull(input.after) });
        const next: { id: string | null } = { id: null };
        const last = page.items.at(-1);

        if (page.hasMore && last !== undefined) {
          next.id = last.id;
        }

        return { routines: page.items.map(routineWire), has_more: page.hasMore, next_after: next.id };
      },
    }),
    deleteRoutine: validatedOperation({
      operation: catalog.deleteRoutine,
      run: async ({ input, caller }) => {
        const { actor, principalId } = await requireMech(caller, input);
        const routine = await actor.deleteRoutine({ ...input, principalId });

        return routineWire(routine);
      },
    }),
  };
}

function routineWire(routine: ActorRoutine) {
  return {
    id: routine.id,
    mech_id: routine.mechId,
    revision: routine.revision,
    name: routine.name,
    text: routine.text,
    every_seconds: routine.everySeconds,
    status: routine.status,
    created_at: routine.createdAt,
    updated_at: routine.updatedAt,
    anchor_at: routine.anchorAt,
    next_due_at: routine.nextDueAt,
    last_due_at: routine.lastDueAt,
    last_delivered_at: routine.lastDeliveredAt,
    last_notification_id: routine.lastNotificationId,
    last_observed_at: routine.lastObservedAt,
    last_observed_due_at: routine.lastObservedDueAt,
    last_observed_notification_id: routine.lastObservedNotificationId,
    last_observed_run_id: routine.lastObservedRunId,
  };
}

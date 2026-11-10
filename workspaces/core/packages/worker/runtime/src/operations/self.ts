import type { ControlStore } from '@mechane/control-store';
import { catalog, KeyMissing, MechArchived, RequestInvalid, WorkspaceSuspended } from '@mechane/protocol';
import { MechId, WorkspaceId } from '@mechane/records';
import { DateTime, Duration, Option } from 'effect';
import type { ActorWake, MechActorResolver } from '../actor/client.ts';
import { consoleMessageWire } from './notifications.ts';
import type { AuthCaller } from './types.ts';
import { validatedOperation } from './validated-operation.ts';

const WAKE_PAGE_MAX_ROWS = 50;

type SelfOperationsInput = { readonly store: ControlStore; readonly actors: MechActorResolver };

export function createSelfOperations({ store, actors }: SelfOperationsInput) {
  function selfCaller(caller: AuthCaller) {
    if (caller.authKind !== 'self') {
      throw new KeyMissing({});
    }

    return caller;
  }

  async function requireSelf(caller: AuthCaller) {
    const self = selfCaller(caller);
    const mech = await store.getMech(self);
    const policy = await store.showWorkspacePolicy(self.workspaceId);

    if (policy.isSuspended) {
      throw new WorkspaceSuspended({ workspaceId: WorkspaceId.make(self.workspaceId) });
    }

    if (mech.status === 'archived') {
      throw new MechArchived({ mechId: MechId.make(mech.id) });
    }

    return actors(self);
  }

  return {
    scheduleSelfWake: validatedOperation({
      operation: catalog.scheduleSelfWake,
      run: async ({ caller, input }) => {
        const actor = await requireSelf(caller);

        if ((input.at === undefined) === (input.after === undefined)) {
          throw new RequestInvalid({ reason: 'A wake requires exactly one of at or after_seconds' });
        }

        if (input.at !== undefined) {
          const wake = await actor.scheduleWake({
            wakeId: input.wakeId,
            text: input.text,
            at: DateTime.formatIso(input.at),
          });

          return wakeWire(wake);
        }

        if (input.after === undefined) {
          throw new RequestInvalid({ reason: 'A wake requires a deadline' });
        }

        const wake = await actor.scheduleWake({
          wakeId: input.wakeId,
          text: input.text,
          afterSeconds: Duration.toSeconds(input.after),
        });

        return wakeWire(wake);
      },
    }),
    showSelfWake: validatedOperation({
      operation: catalog.showSelfWake,
      run: async ({ caller, input }) => {
        const actor = await requireSelf(caller);
        const wake = await actor.readWake(input);

        if (wake === null) {
          throw new RequestInvalid({ reason: 'The wake does not exist for this mech' });
        }

        return wakeWire(wake);
      },
    }),
    listSelfWakes: validatedOperation({
      operation: catalog.listSelfWakes,
      run: async ({ caller, input }) => {
        const actor = await requireSelf(caller);
        const page = await actor.listWakes({ after: Option.getOrNull(input.after), maxRows: WAKE_PAGE_MAX_ROWS });
        const last = page.items.at(-1);
        const next: { id: string | null } = { id: null };

        if (page.hasMore && last !== undefined) {
          next.id = last.id;
        }

        return { wakes: page.items.map(wakeWire), has_more: page.hasMore, next_after: next.id };
      },
    }),
    cancelSelfWake: validatedOperation({
      operation: catalog.cancelSelfWake,
      run: async ({ caller, input }) => {
        const actor = await requireSelf(caller);
        const wake = await actor.cancelWake(input);

        return wakeWire(wake);
      },
    }),
    publishSelfMessage: validatedOperation({
      operation: catalog.publishSelfMessage,
      run: async ({ caller, input }) => {
        const actor = actors(selfCaller(caller));
        const message = await actor.publishMessage(input);

        return consoleMessageWire(message);
      },
    }),
  };
}

function wakeWire(wake: ActorWake) {
  return {
    id: wake.id,
    mech_id: wake.mechId,
    status: wake.status,
    text: wake.text,
    created_at: wake.createdAt,
    due_at: wake.dueAt,
    canceled_at: wake.canceledAt,
    delivered_at: wake.deliveredAt,
    notification_id: wake.notificationId,
  };
}

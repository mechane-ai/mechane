import type { Reservation, ReserveInput } from '@mechane/harness';
import { DispatchId } from '@mechane/records';
import { ReservationDecision, workspaceStub } from '@mechane/rpc';
import { DateTime, Match, Schema } from 'effect';
import { boundMicros } from './bound-micros.ts';
import { refuseDispatch, refusedReservation } from './refuse-dispatch.ts';
import { settleDispatch } from './settle-dispatch.ts';
import type { AllowanceInput, DispatchMeterInput } from './types.ts';

/** A dispatch to reserve, and what the meter reserves it through. */
type ReserveDispatchInput = DispatchMeterInput &
  ReserveInput & { readonly allowance: (input: AllowanceInput) => Promise<number> };

/**
 * Reserves a dispatch's bound in its workspace's ledger, under the id of its turn or its drone. A refusal is recorded
 * on that turn or drone before the dispatch ends, so its projection can tell an exhausted allowance from a failed
 * model.
 */
export async function reserveDispatch({
  store,
  settings,
  abortObject,
  allowance,
  offer,
  contextBytes,
  contextJson,
  sessionId,
}: ReserveDispatchInput): Promise<Reservation> {
  const id = DispatchId.make(crypto.randomUUID());
  const now = DateTime.nowUnsafe();

  const target = await store.atomic({
    run: (tables) => ({
      ...tables.dispatchTarget({ sessionId }),
      bound: tables.claimBoundedDispatch({ sessionId, dispatchId: id, now }),
    }),
  });

  if (!target.bound.isAllowed) {
    return refusedReservation();
  }

  const { workspaceId, mechId, dailyCapMicros, work, bound } = target;
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const requestedMicros = boundMicros({ offer, contextBytes });
  const dispatch = { id, mechId, workId: work.id, model: offer.id, requestedMicros };
  const allowanceMicros = await allowance({ workspaceId });
  const decision = await workspace.reserveDispatch({ dispatch, allowanceMicros, capMicros: dailyCapMicros });

  const granted: () => Promise<Reservation> = async () => {
    await store.atomic({
      run: (tables) =>
        tables.beginDispatchEvidence({
          dispatchId: id,
          sessionId,
          requestId: bound.requestId,
          model: offer.id,
          contextJson,
          now,
        }),
    });

    return {
      _tag: 'Granted',
      endUserId: workspaceId,
      maxOutputTokens: bound.maxOutputTokens,
      deadlineAt: bound.deadlineAt,
      recordRequest: async ({ requestJson }) => {
        const requestedAt = DateTime.nowUnsafe();

        return await store.atomic({
          run: (tables) => tables.recordDispatchRequest({ dispatchId: id, requestJson, now: requestedAt }),
        });
      },
      settle: async ({ usage, responseJson, status }) => {
        const endedAt = DateTime.nowUnsafe();

        await store.atomic({
          run: (tables) => tables.endDispatchEvidence({ dispatchId: id, responseJson, status, now: endedAt }),
        });
        await settleDispatch({ workspace, dispatch, offer, usage, abortObject });
      },
    };
  };

  return await Match.valueTags(Schema.decodeUnknownSync(ReservationDecision)(decision), {
    Granted: granted,
    Refused: async () => await refuseDispatch({ store, workspaceId, dispatch, work }),
  });
}

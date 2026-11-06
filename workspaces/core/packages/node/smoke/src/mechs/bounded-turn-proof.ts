import { BoundedCallStatus, BoundedTurn, BoundedTurnStatus } from '@mechane/protocol';
import { BoundedRequestId } from '@mechane/records';
import type { Stack } from '@mechane/stack';
import { toolCallLine } from '@mechane/testing';
import type { ScenarioFailure, TalkingMech } from '@mechane/testing';
import { DateTime, Duration, Effect, Option, Result, Schema } from 'effect';
import { hasConversationCache } from './has-conversation-cache.ts';

type BoundedTurnProofInput = { readonly stack: Stack; readonly mech: TalkingMech };
type BoundedTurnProof = { readonly conditions: ReadonlyArray<boolean>; readonly detail: string };
type OutputLimitInput = { readonly payload: unknown };

const BOUNDED_OUTPUT_TOKENS = 128;
const BOUNDED_REQUESTS = 2;
const BOUNDED_DEADLINE = Duration.minutes(2);
const BOUNDED_REPLY = 'bounded reply';

const OutputLimit = Schema.Union([
  Schema.Struct({ max_tokens: Schema.Int }),
  Schema.Struct({ max_completion_tokens: Schema.Int }),
]);

/** The provider count detects repeated paid work; the tool round requires a second attempt that the cap must refuse. */
export const boundedTurnProof = Effect.fn('boundedTurnProof')(function* ({
  stack,
  mech,
}: BoundedTurnProofInput): Effect.fn.Return<BoundedTurnProof, ScenarioFailure> {
  const before = stack.modelUpstream.requests().length;
  const requestId = BoundedRequestId.make(crypto.randomUUID());
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, BOUNDED_DEADLINE);

  const limits = [
    '--max-model-dispatches',
    '1',
    '--max-output-tokens',
    String(BOUNDED_OUTPUT_TOKENS),
    '--deadline-at',
    DateTime.formatIso(deadline),
  ];

  const submit = { words: ['bounded-turn', 'submit'], ids: [requestId, BOUNDED_REPLY, ...limits], result: BoundedTurn };

  yield* mech.command(submit);
  yield* mech.command(submit);
  yield* mech.follower.awaitTurnEnd();

  const answered = yield* mech.command({ words: ['bounded-turn', 'show'], ids: [requestId], result: BoundedTurn });
  const replayed = yield* mech.command(submit);
  const cappedId = BoundedRequestId.make(crypto.randomUUID());
  const toolRequest = toolCallLine({ tool: 'memory_read', input: { path: 'bounded-proof' } });

  yield* mech.command({
    words: ['bounded-turn', 'submit'],
    ids: [cappedId, toolRequest, ...limits],
    result: BoundedTurn,
  });
  yield* mech.follower.awaitTurnEnd();

  const capped = yield* mech.command({ words: ['bounded-turn', 'show'], ids: [cappedId], result: BoundedTurn });
  const requests = stack.modelUpstream.requests().slice(before);
  const dispatchEvidence = [...answered.dispatchEvidence, ...capped.dispatchEvidence];

  return {
    conditions: [
      answered.status === BoundedTurnStatus.Answered,
      Option.contains(answered.reply, BOUNDED_REPLY),
      answered.isEvidenceComplete,
      replayed.requestId === requestId && Option.isSome(replayed.endedAt),
      requests.length === BOUNDED_REQUESTS,
      dispatchEvidence.length === BOUNDED_REQUESTS,
      dispatchEvidence.every((call) => call.status === BoundedCallStatus.Completed && Option.isSome(call.response)),
      dispatchEvidence.every((call) => hasOutputLimit({ payload: call.request })),
      dispatchEvidence.every((call) => hasConversationCache({ payload: call.request })),
      capped.status === BoundedTurnStatus.Unanswered && Option.contains(capped.reason, 'dispatch_limit'),
      capped.isEvidenceComplete,
      capped.toolCalls.length === 1 && capped.toolCalls.every((call) => Option.isSome(call.output)),
    ],
    detail: `bounded ${requestId} answered ${answered.status} with ${answered.dispatchEvidence.length} calls; capped ${cappedId} ended ${capped.status} with ${capped.dispatchEvidence.length} calls and ${capped.toolCalls.length} tools; upstream received ${requests.length} requests`,
  };
});

function hasOutputLimit({ payload }: OutputLimitInput): boolean {
  const decoded = Schema.decodeUnknownResult(OutputLimit)(payload);

  if (Result.isFailure(decoded)) {
    return false;
  }

  if ('max_tokens' in decoded.success) {
    return decoded.success.max_tokens === BOUNDED_OUTPUT_TOKENS;
  }

  return decoded.success.max_completion_tokens === BOUNDED_OUTPUT_TOKENS;
}

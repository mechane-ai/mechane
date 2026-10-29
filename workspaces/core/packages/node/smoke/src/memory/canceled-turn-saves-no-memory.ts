import { EventType, UnansweredReason } from '@mechane/protocol';
import { check, signedInMech, turnOutcome } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput, TurnEndEvent } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import { ScenarioPath } from './constants.ts';
import { interruptedTurn } from './interrupted-turn.ts';
import { memberCanceledTurn } from './member-canceled-turn.ts';

/**
 * A member twice cancels a turn that wrote a draft and waits at a gate, then an interrupt cancels the queued turn,
 * writes a memory and reads the draft. Both turns end canceled, the interrupt answers without the draft, and only its
 * memory is saved. A later request carries the draft's digest, which only its write's result names, so the draft's
 * write ran before its turn was canceled.
 */
export const canceledTurnSavesNoMemory = Effect.fn('canceledTurnSavesNoMemory')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const member = yield* memberCanceledTurn({ stack, mech });
  const { cut, answered, saved } = yield* interruptedTurn({ mech, queued: member.queued });
  const digest = createHash('sha256').update(member.draft).digest('hex');
  const isDraftWritten = stack.modelUpstream.requests().some(({ body }) => body.includes(digest));

  const isCanceled: (ended: TurnEndEvent) => boolean = (ended) =>
    ended.type === EventType.TurnUnanswered && ended.reason === UnansweredReason.Canceled;

  yield* check({
    name: guarantee,
    conditions: [
      member.pending.length === 0,
      member.canceled.turnId === member.startedTurnId,
      new Set(member.cancelTimes).size === 1,
      [member.canceled, cut].every(isCanceled),
      answered.type === EventType.TurnAnswered && !answered.reply.includes(member.draft),
      isDraftWritten,
      JSON.stringify(saved) === JSON.stringify([ScenarioPath.Kept]),
    ],
    detail: `while the draft's turn ran, memory held ${JSON.stringify(member.pending)}; its cancels answered ${member.cancelTimes.join(' and ')}, and it ended ${turnOutcome({ ended: member.canceled })}; the interrupted turn ended ${turnOutcome({ ended: cut })} and the interrupt ${turnOutcome({ ended: answered })}; memory then held ${JSON.stringify(saved)}; a request carried the draft's digest: ${isDraftWritten}`,
  });
}, Effect.scoped);

import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { THREAD_NOTE_MAX_CHARS, ThreadNote, ThreadState } from '@mechane/protocol';
import { DurationFromSeconds, isBetweenDuration, renamedWireStruct, ThreadId } from '@mechane/records';
import { Duration, Match, Option, Record, Result, Schema } from 'effect';
import { Type } from 'typebox';
import { textResult } from '../text-result.ts';
import type { OutcomeResults, ThreadChange } from '../types.ts';
import { ThreadDescription, ThreadTool } from './constants.ts';
import { invalidResult } from './invalid-result.ts';
import type { ThreadChangeOutcome } from './schemas.ts';
import { ThreadIdParameter } from './schemas.ts';
import { THREAD_REFUSAL_RESULTS } from './thread-refusal-results.ts';
import type { ThreadsInput } from './types.ts';

const MINIMUM_RESUME_DELAY = Duration.seconds(30);
const MAXIMUM_RESUME_DELAY = Duration.days(1);

/** What the model passes to update_thread: the thread, its new state, and the note that replaces its own, if any. */
const UpdateThreadParameters = Type.Object({
  thread_id: ThreadIdParameter,
  state: Type.String({ description: `One of ${Record.values(ThreadState).join(', ')}` }),
  resume_after_seconds: Type.Optional(
    Type.Integer({
      minimum: Duration.toSeconds(MINIMUM_RESUME_DELAY),
      maximum: Duration.toSeconds(MAXIMUM_RESUME_DELAY),
      description:
        'When waiting, wake this work again after 30 seconds to one day. Omit to wait for a message instead.',
    }),
  ),
  note: Type.Optional(
    Type.String({ description: `Where the work stands now, in at most ${THREAD_NOTE_MAX_CHARS} characters` }),
  ),
});

/** The tool's arguments as it decodes them. */
const UpdateThreadArguments = renamedWireStruct({
  fields: {
    threadId: ThreadId,
    state: Schema.Enum(ThreadState),
    resumeAfter: Schema.OptionFromOptionalKey(
      DurationFromSeconds.check(isBetweenDuration({ minimum: MINIMUM_RESUME_DELAY, maximum: MAXIMUM_RESUME_DELAY })),
    ),
    /** The note that replaces the thread's; none keeps the one it has. */
    note: Schema.OptionFromOptionalKey(ThreadNote),
  },
  renames: { resumeAfter: 'resume_after_seconds' },
});

type UpdateThreadArguments = typeof UpdateThreadArguments.Type;

/** What the tool answers for each outcome of a change, with the thread and the state the call named. */
const UPDATE_RESULTS: Readonly<OutcomeResults<ThreadChangeOutcome & Pick<ThreadChange, 'threadId' | 'state'>>> = {
  Updated: ({ threadId, state }) => textResult({ text: `Thread ${threadId} is ${state}` }),
  ...THREAD_REFUSAL_RESULTS,
};

/**
 * Changes a thread's state and note. After a restart, pi may run it again: a change a thread already holds answers as
 * made, even on a resolved thread.
 */
export function updateThreadTool({ threads }: ThreadsInput): ToolRegistration<typeof UpdateThreadParameters> {
  const execute: ToolRegistration<typeof UpdateThreadParameters>['execute'] = async (args, api) => {
    const decoded = Schema.decodeUnknownResult(UpdateThreadArguments)(args);

    if (Result.isFailure(decoded)) {
      return invalidResult({ issue: decoded.failure.message });
    }

    const { threadId, state, note, resumeAfter } = decoded.success;

    if (Option.isSome(resumeAfter) && state !== ThreadState.Waiting) {
      return invalidResult({ issue: 'resume_after_seconds requires the waiting state' });
    }

    const outcome = await threads.update({ taskId: api.taskId, threadId, state, note, resumeAfter });

    return Match.valueTags({ ...outcome, threadId, state }, UPDATE_RESULTS);
  };

  return defineTool({
    name: ThreadTool.Update,
    description: ThreadDescription.Update,
    parameters: UpdateThreadParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute,
  });
}

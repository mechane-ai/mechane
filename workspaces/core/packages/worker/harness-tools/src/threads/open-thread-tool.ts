import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { OPEN_THREADS_PER_MECH, THREAD_TITLE_MAX_CHARS, ThreadTitle } from '@mechane/protocol';
import { Match, Result, Schema } from 'effect';
import { Type } from 'typebox';
import { failedResult } from '../failed-result.ts';
import { textResult } from '../text-result.ts';
import type { OutcomeResults } from '../types.ts';
import { ThreadDescription, ThreadDiagnostic, ThreadTool } from './constants.ts';
import { invalidResult } from './invalid-result.ts';
import type { ThreadOpeningOutcome } from './schemas.ts';
import type { ThreadsInput } from './types.ts';

/** What the model passes to open_thread: the thread's title, which the tool decodes with the protocol's schema. */
const OpenThreadParameters = Type.Object({
  title: Type.String({ description: `What the thread is about, in at most ${THREAD_TITLE_MAX_CHARS} characters` }),
});

/** The tool's arguments as it decodes them. */
const OpenThreadArguments = Schema.Struct({ title: ThreadTitle });

type OpenThreadArguments = typeof OpenThreadArguments.Type;

/** What the tool answers for each outcome of an opening. */
const OPENING_RESULTS: Readonly<OutcomeResults<ThreadOpeningOutcome>> = {
  Opened: ({ threadId }) => textResult({ text: `Opened thread ${threadId}, working` }),
  ThreadsFull: () =>
    failedResult({
      code: ThreadDiagnostic.Full,
      message: `You keep ${OPEN_THREADS_PER_MECH} open threads already: resolve one first`,
    }),
};

/** Opens a working thread under the tool's task, whose recorded thread answers pi's rerun after a restart. */
export function openThreadTool({ threads }: ThreadsInput): ToolRegistration<typeof OpenThreadParameters> {
  const execute: ToolRegistration<typeof OpenThreadParameters>['execute'] = async (args, api) => {
    const decoded = Schema.decodeUnknownResult(OpenThreadArguments)(args);

    if (Result.isFailure(decoded)) {
      return invalidResult({ issue: decoded.failure.message });
    }

    const outcome = await threads.open({ taskId: api.taskId, title: decoded.success.title });

    return Match.valueTags(outcome, OPENING_RESULTS);
  };

  return defineTool({
    name: ThreadTool.Open,
    description: ThreadDescription.Open,
    parameters: OpenThreadParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute,
  });
}

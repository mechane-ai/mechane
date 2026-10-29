import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { InboxText, RUNNING_DRONES_PER_MECH } from '@mechane/protocol';
import { ThreadId, wireStruct } from '@mechane/records';
import { Match, Result, Schema } from 'effect';
import { Type } from 'typebox';
import { failedResult } from '../failed-result.ts';
import { textResult } from '../text-result.ts';
import type { DroneStart, OutcomeResults } from '../types.ts';
import { ThreadDescription, ThreadDiagnostic, ThreadTool } from './constants.ts';
import { invalidResult } from './invalid-result.ts';
import type { DroneStartOutcome } from './schemas.ts';
import { ThreadIdParameter } from './schemas.ts';
import { THREAD_REFUSAL_RESULTS } from './thread-refusal-results.ts';
import type { ThreadsInput } from './types.ts';

/** What the model passes to start_drone: the open thread to start the drone on, and its brief. */
const StartDroneParameters = Type.Object({
  thread_id: ThreadIdParameter,
  brief: Type.String({ description: 'Everything the drone needs to know to do its task and report back' }),
});

/** A drone's brief reaches the drone as an inbox item reaches its mech, so it is bounded as an item's text. */
const StartDroneArguments = wireStruct({ fields: { threadId: ThreadId, brief: InboxText } });

type StartDroneArguments = typeof StartDroneArguments.Type;

/** What the tool answers for each outcome of a start, with the thread the call named. */
const START_RESULTS: Readonly<OutcomeResults<DroneStartOutcome & Pick<DroneStart, 'threadId'>>> = {
  Started: ({ droneId, threadId }) =>
    textResult({
      text: `Started drone ${droneId} on thread ${threadId}; its report arrives in your inbox when it ends.`,
    }),
  ...THREAD_REFUSAL_RESULTS,
  DronesFull: () =>
    failedResult({
      code: ThreadDiagnostic.DronesFull,
      message: `You run ${RUNNING_DRONES_PER_MECH} drones already: start another once one reports`,
    }),
};

/**
 * Records a drone on a thread under the tool's task, for the alarm to start, and never calls pi. A tool's commit throws
 * once its task is abort-marked, so a canceled turn could otherwise keep a drone pi never starts. After a restart, pi
 * may run it again, and the task's recorded drone answers the rerun.
 */
export function startDroneTool({ threads }: ThreadsInput): ToolRegistration<typeof StartDroneParameters> {
  const execute: ToolRegistration<typeof StartDroneParameters>['execute'] = async (args, api) => {
    const decoded = Schema.decodeUnknownResult(StartDroneArguments)(args);

    if (Result.isFailure(decoded)) {
      return invalidResult({ issue: decoded.failure.message });
    }

    const { threadId, brief } = decoded.success;
    const outcome = await threads.startDrone({ taskId: api.taskId, threadId, brief });

    return Match.valueTags({ ...outcome, threadId }, START_RESULTS);
  };

  return defineTool({
    name: ThreadTool.StartDrone,
    description: ThreadDescription.StartDrone,
    parameters: StartDroneParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute,
  });
}

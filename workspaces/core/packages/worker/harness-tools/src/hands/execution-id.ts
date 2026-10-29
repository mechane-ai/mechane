import { EXECUTION_ID_PREFIX } from '@mechane/sandbox-wire';

type TaskIdInput = { readonly taskId: number };

/**
 * The id of the execution a tool call runs: its pi tool task's, the one builder of an execution id. After a restart, pi
 * reruns a task with the arguments it recorded, so the rerun asks for the execution it already started, and joins it.
 */
export function executionId({ taskId }: TaskIdInput): string {
  return `${EXECUTION_ID_PREFIX}${taskId}`;
}

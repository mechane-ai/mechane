import type { RecordId } from '@mechane/records';
import { Schema } from 'effect';
import type { Duration } from 'effect';
import { GuestSegment } from './constants.ts';
import { ExecutionWait } from './schemas.ts';
import type { ExecutionId } from './schemas.ts';

/** The machine whose guest runs the execution, the execution's id, and how long the guest may wait for its receipt. */
type GuestExecutionPathInput = {
  readonly machineId: RecordId;
  readonly executionId: ExecutionId;
  readonly wait: Duration.Duration;
};

/**
 * The guest's path for one execution of a machine, asking it to wait up to `wait` for the receipt. Each id is
 * percent-encoded, and the query is the wait's encoding.
 */
export function guestExecutionPath({ machineId, executionId, wait }: GuestExecutionPathInput): string {
  const machineSegment = encodeURIComponent(machineId);
  const executionSegment = encodeURIComponent(executionId);
  const fields = Schema.encodeSync(ExecutionWait)({ wait });
  const query = new URLSearchParams(fields);

  return `/${GuestSegment.Machines}/${machineSegment}/${GuestSegment.Executions}/${executionSegment}?${query.toString()}`;
}

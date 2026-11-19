import { OperationFailed } from '@mechane/client';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedId } from './managed-records.ts';

export class ManagedResourceMismatch extends Schema.TaggedError<ManagedResourceMismatch>()(
  'ManagedResourceMismatch',
  {},
) {}

export class ManagedSessionUnavailable extends Schema.TaggedError<ManagedSessionUnavailable>()(
  'ManagedSessionUnavailable',
  { agentId: ManagedId, sessionId: ManagedId },
) {}

export function managedStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || Schema.is(OperationFailed)(error)) {
    return undefined;
  }

  return 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}

const unavailableStatus: ReadonlySet<number | undefined> = new Set([HttpStatusCode.NotFound, HttpStatusCode.Forbidden]);

export function isManagedResourceDenied(error: unknown): boolean {
  return unavailableStatus.has(managedStatus(error));
}

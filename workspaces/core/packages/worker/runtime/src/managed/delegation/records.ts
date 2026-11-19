import { defineDoc, defineDocFamily } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { actorRecordCollection, actorRecordSet } from '../../actor/record-store.ts';
import { ManagedSessionOpen } from '../protocol.ts';
import { ManagedDelegationOrigin } from './protocol.ts';

export const Child = Schema.Struct({
  origin: ManagedDelegationOrigin,
  open: ManagedSessionOpen,
  parentName: Schema.String,
  agentName: Schema.String,
  offset: Schema.Int,
  recoveryRevision: Schema.optional(Schema.Int),
  pendingBudgetRevision: Schema.optional(Schema.Int),
  isOpened: Schema.Boolean,
  retirement: Schema.Literals(['live', 'stop', 'stopped', 'delete']),
});

export type Child = typeof Child.Type;
export const Children = actorRecordCollection('managed.delegated-thread', Child);
export const ActiveChildren = actorRecordSet('managed.pending-children');

export const DispatchCursor = defineDoc<{ readonly offset: number }>({
  kind: 'managed.child-dispatch-cursor',
  version: 1,
  scope: 'session',
  checkpointWhen: () => true,
  initial: () => ({ offset: 0 }),
});

export const ToolCalls = defineDocFamily<{ readonly threadId: string; readonly digest: string }, null>({
  kind: 'managed.delegation-receipt',
  version: 1,
  family: true,
  scope: 'session',
  checkpointWhen: () => true,
  initial: () => ({ threadId: '', digest: '' }),
});

const PendingInput = Schema.Struct({
  deliveryId: Schema.NonEmptyString,
  eventType: Schema.NonEmptyString,
  isBroadcast: Schema.Boolean,
});

export type PendingChildInput = typeof PendingInput.Type;

export function pendingInputs(threadId: string) {
  return actorRecordCollection(JSON.stringify(['managed.child-pending-inputs', threadId]), PendingInput);
}

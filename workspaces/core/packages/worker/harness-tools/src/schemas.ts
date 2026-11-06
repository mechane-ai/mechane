import { RecordText } from '@mechane/records';
import { Schema } from 'effect';
import { SandboxRefusal } from './constants.ts';

/**
 * A command the mech's hands refused before any sandbox call, and the machines its workspace may run at once. Its
 * workspace has no sandbox, or runs that many machines already.
 */
export const HandsRefusal = Schema.TaggedStruct('Refused', {
  reason: Schema.Enum(SandboxRefusal),
  machines: Schema.Int,
});

export type HandsRefusal = typeof HandsRefusal.Type;

/** Credential preparation failed before the command was dispatched. */
export const ExecutionAccessUnavailable = Schema.TaggedStruct('ExecutionAccessUnavailable', { reason: RecordText });
export type ExecutionAccessUnavailable = typeof ExecutionAccessUnavailable.Type;

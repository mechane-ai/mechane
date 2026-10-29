import { RecordText } from '@mechane/records';
import { SourceCheckout, SourceFencePhase } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { MachineIdRow } from '../schemas.ts';

/** Durable checkout identity, machine preparation, and credential exposure needed to resume a source fence. */
export const SourceFence = Schema.Struct({
  ...SourceCheckout.fields,
  phase: Schema.Enum(SourceFencePhase),
  /** Absent until a fresh machine generation is allocated for this checkout. */
  machineId: Schema.OptionFromNullOr(MachineIdRow.fields.id),
  /** Absent until credentials are exposed; no expiry may be inferred while absent. */
  expiresAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  preparationDeadline: Schema.DateTimeUtcFromMillis,
  isMachineStarted: Schema.Boolean,
  isCloned: Schema.Boolean,
  /** Absent when no source operation has reported a failure. */
  reason: Schema.OptionFromNullOr(RecordText),
});

export type SourceFence = typeof SourceFence.Type;

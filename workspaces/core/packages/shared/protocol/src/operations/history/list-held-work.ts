import { RecordId, RecordText, TurnId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { RequestInvalid } from '../../errors/errors.ts';
import type { Operation } from '../../operation/types.ts';
import { WireTime } from '../../schemas.ts';
import { OPERATOR_MECH_READ } from '../mech-read.ts';
import { NotificationId, RecordedNotificationSource } from '../notifications/schemas.ts';
import { RoutineInterval } from '../routines/schemas.ts';
import { MechHistoryCursor } from './schemas.ts';

const HeldWorkKind = {
  Notification: 'notification',
  Turn: 'turn',
  Effect: 'effect',
  ProviderAttempt: 'provider_attempt',
  Cancellation: 'cancellation',
  Wake: 'wake',
  Routine: 'routine',
  WorkItem: 'work_item',
} as const;

const HeldWorkId = RecordId.pipe(Schema.brand('HeldWorkId'));

const HeldWorkItem = wireStruct({
  fields: {
    kind: Schema.Enum(HeldWorkKind),
    id: HeldWorkId,
    status: RecordText,
    turnId: Schema.optionalKey(TurnId),
    source: Schema.optionalKey(RecordedNotificationSource),
    recordedOutcome: Schema.optional(RecordText),
    notificationId: Schema.optionalKey(NotificationId),
    dueAt: Schema.optional(WireTime),
    everySeconds: Schema.optionalKey(RoutineInterval),
  },
});

/** A retained work or effect reference with its last recorded outcome. */
export type HeldWorkItem = typeof HeldWorkItem.Encoded;
const NextCursor = Schema.OptionFromNullOr(MechHistoryCursor);
const After = Schema.OptionFromOptionalKey(MechHistoryCursor);

/** A bounded archive scan and the cursor for continuing within the same mech. */
export const HeldWorkPage = wireStruct({ fields: { items: Schema.Array(HeldWorkItem), nextCursor: NextCursor } });

/** Inspect unfinished work in a retired actor. Continue while a cursor is present, including after an empty page. */
export const listHeldWork = {
  ...OPERATOR_MECH_READ,
  path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/held-work',
  query: Schema.Struct({ after: After }),
  output: HeldWorkPage,
  errors: [...OPERATOR_MECH_READ.errors, RequestInvalid],
} as const satisfies Operation;

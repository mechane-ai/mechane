import { SLACK_DELIVERY_FIELDS } from '@mechane/protocol';
import { RecordText, SHA256_PATTERN, SlackDestination, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** A durable outbox receipt with the message and reconciliation state needed after restart. */
export const SlackDeliveryRow = wireStruct({
  fields: {
    ...SLACK_DELIVERY_FIELDS,
    /** Absent until a binding notification freezes its audience. */
    destination: Schema.OptionFromNullOr(Schema.fromJsonString(SlackDestination)),
    text: RecordText,
    /** Absent before the first delivery attempt is durably claimed. */
    contentSha256: Schema.OptionFromNullOr(Schema.String.check(Schema.isPattern(SHA256_PATTERN))),
    /** Absent before the first delivery attempt is durably claimed. */
    attemptedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    reconciliationCount: Schema.Int,
  },
});

export type SlackDeliveryRow = typeof SlackDeliveryRow.Type;

/** The exclusive pending-to-uncertain claim that prevents overlapping posts. */
export const SlackDeliveryClaim = Schema.TaggedUnion({ Claimed: {}, AlreadyClaimed: {} });
export type SlackDeliveryClaim = typeof SlackDeliveryClaim.Type;

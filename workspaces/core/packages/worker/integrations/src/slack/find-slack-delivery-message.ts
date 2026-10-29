import { Option, Result, Schema } from 'effect';
import { SLACK_METADATA_TYPE } from './constants.ts';
import type { SlackHistory } from './schemas.ts';
import type { ReconcileSlackDeliveryInput } from './types.ts';

const SlackDeliveryMetadata = Schema.Struct({
  event_type: Schema.Literal(SLACK_METADATA_TYPE),
  event_payload: Schema.Struct({ delivery_id: Schema.String, content_sha256: Schema.String }),
});

type SlackDeliveryMetadata = typeof SlackDeliveryMetadata.Type;

type FindSlackDeliveryMessageInput = Pick<
  ReconcileSlackDeliveryInput,
  'installation' | 'deliveryId' | 'contentSha256'
> & { readonly history: SlackHistory };

/** Finds positive delivery evidence from bot identity, delivery id, and content digest. */
export function findSlackDeliveryMessage({
  installation,
  deliveryId,
  contentSha256,
  history,
}: FindSlackDeliveryMessageInput): Option.Option<string> {
  const messages = Option.getOrElse(history.messages, () => []);

  const matches: (message: (typeof messages)[number]) => boolean = (message) => {
    const payload = Option.getOrUndefined(message.metadata);
    const metadata = Schema.decodeUnknownResult(SlackDeliveryMetadata)(payload);
    const user = Option.getOrElse(message.user, () => '');

    if (Result.isFailure(metadata)) {
      return false;
    }

    return (
      user === installation.botUserId &&
      metadata.success.event_payload.delivery_id === deliveryId &&
      metadata.success.event_payload.content_sha256 === contentSha256
    );
  };

  const found = messages.find(matches);

  const message = Option.fromUndefinedOr(found);

  return Option.map(message, (value) => value.ts);
}

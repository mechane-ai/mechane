import { SlackBinding, SlackInstallation } from '@mechane/protocol';
import { InboxItemId, SlackEventId } from '@mechane/records';
import { Schema } from 'effect';

/** The binding lookup result, absent when no such binding is configured. */
export const SlackBindingAnswer = Schema.OptionFromNullOr(SlackBinding);
export type SlackBindingAnswer = typeof SlackBindingAnswer.Type;

/** No installation means the callback is disconnected, distinct from a failed storage lookup. */
export const SlackInstallationAnswer = Schema.OptionFromNullOr(SlackInstallation);
export type SlackInstallationAnswer = typeof SlackInstallationAnswer.Type;

/** The durable inbox identity and binding selected for a signed Slack event. */
export const SlackEventAdmission = Schema.TaggedUnion({
  Admitted: { inboxItemId: InboxItemId, eventId: SlackEventId, binding: SlackBinding },
  Ignored: {},
  Conflicting: {},
});

export type SlackEventAdmission = typeof SlackEventAdmission.Type;

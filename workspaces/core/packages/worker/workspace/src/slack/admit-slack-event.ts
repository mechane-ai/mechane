import { InboxItemId } from '@mechane/records';
import { SlackEventAdmission } from '@mechane/rpc';
import type { AdmitSlackEventInput } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';

type AdmitEventInput = AdmitSlackEventInput & { readonly store: WorkspaceStore };

type DecideSlackAdmissionInput = Pick<
  typeof SlackEventAdmission.cases.Admitted.Type,
  'inboxItemId' | 'eventId' | 'binding'
> &
  Pick<AdmitEventInput, 'userId'>;

/** Records one canonical admission per event or message identity before paid work can begin. */
export function admitSlackEvent({
  store,
  connectionId,
  eventId,
  teamId,
  channelId,
  messageTimestamp,
  fingerprint,
  userId,
}: AdmitEventInput): SlackEventAdmission {
  const installation = store.slackInstallation({ connectionId });
  const isInstalled = Option.exists(installation, (current) => current.teamId === teamId);

  if (!isInstalled) {
    return SlackEventAdmission.cases.Ignored.make({});
  }

  const binding = store.slackRoute({ connectionId, teamId, channelId });

  if (Option.isNone(binding) || !binding.value.isListening) {
    return SlackEventAdmission.cases.Ignored.make({});
  }

  const existing = store.slackEvent({ connectionId, eventId, teamId, channelId, messageTimestamp });

  if (Option.isSome(existing)) {
    if (existing.value.fingerprint !== fingerprint) {
      return SlackEventAdmission.cases.Conflicting.make({});
    }

    return decideSlackAdmission({ ...existing.value, binding: binding.value, userId });
  }

  const inboxItemId = InboxItemId.make(crypto.randomUUID());
  const admitted = { inboxItemId, eventId, fingerprint, binding: binding.value };

  store.recordSlackEvent({ connectionId, teamId, channelId, messageTimestamp, ...admitted });

  return decideSlackAdmission({ ...admitted, userId });
}

function decideSlackAdmission({ userId, ...admission }: DecideSlackAdmissionInput): SlackEventAdmission {
  const allowedUsers = Option.fromUndefinedOr(admission.binding.allowedUserIds);

  if (Option.exists(allowedUsers, (users) => !users.includes(userId))) {
    return SlackEventAdmission.cases.Refused.make(admission);
  }

  return SlackEventAdmission.cases.Admitted.make(admission);
}

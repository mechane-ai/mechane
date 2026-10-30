import { InboxItemId } from '@mechane/records';
import { SlackEventAdmission } from '@mechane/rpc';
import type { AdmitSlackEventInput } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option } from 'effect';

type AdmitEventInput = AdmitSlackEventInput & { readonly store: WorkspaceStore };

/** Records one canonical admission per event or message identity before paid work can begin. */
export function admitSlackEvent({
  store,
  connectionId,
  eventId,
  teamId,
  channelId,
  messageTimestamp,
  fingerprint,
}: AdmitEventInput): SlackEventAdmission {
  const installation = store.slackInstallation({ connectionId });
  const isInstalled = Option.exists(installation, (current) => current.teamId === teamId);

  if (!isInstalled) {
    return SlackEventAdmission.cases.Ignored.make({});
  }

  const existing = store.slackEvent({ connectionId, eventId, teamId, channelId, messageTimestamp });

  if (Option.isSome(existing)) {
    if (existing.value.fingerprint !== fingerprint) {
      return SlackEventAdmission.cases.Conflicting.make({});
    }

    return SlackEventAdmission.cases.Admitted.make(existing.value);
  }

  const binding = store.slackRoute({ connectionId, teamId, channelId });

  if (Option.isNone(binding) || !binding.value.isListening) {
    return SlackEventAdmission.cases.Ignored.make({});
  }

  const inboxItemId = InboxItemId.make(crypto.randomUUID());
  const admitted = { inboxItemId, eventId, fingerprint, binding: binding.value };

  store.recordSlackEvent({ connectionId, teamId, channelId, messageTimestamp, ...admitted });

  return SlackEventAdmission.cases.Admitted.make(admitted);
}

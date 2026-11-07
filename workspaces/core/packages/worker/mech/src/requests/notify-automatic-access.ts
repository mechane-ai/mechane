import type { MechTables } from '@mechane/mech-store';
import { ExternalRequestAuthorization } from '@mechane/protocol';
import type { ThreadId } from '@mechane/records';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { automaticAccessNoticeKey } from './automatic-access-notice-key.ts';

type NotifyInput = {
  readonly store: MechTables;
  readonly taskId: number;
  readonly threadId: ThreadId;
  /** None produces a generic notice when a recovered response has no capability label. */
  readonly capability: Option.Option<string>;
  /** None means the service did not classify this outcome as an access grant. */
  readonly authorization: Option.Option<ExternalRequestAuthorization>;
  readonly now: DateTime.Utc;
};

/** Automatic grants remain visible even when the model omits them from its final reply. */
export function notifyAutomaticAccess({ store, taskId, threadId, capability, authorization, now }: NotifyInput): void {
  if (!Option.contains(authorization, ExternalRequestAuthorization.Automatic)) {
    return;
  }

  const inbox = store.threadOrigin({ threadId });
  const origin = Option.flatMap(inbox, (inboxItemId) => store.slackInboxOrigin({ inboxItemId }));

  const access = Option.match(capability, {
    onNone: () => 'Temporary access granted automatically.',
    onSome: (label) => `Temporary access granted: ${label}.`,
  });

  if (Option.isSome(origin)) {
    const noticeKey = automaticAccessNoticeKey({ taskId });

    store.enqueueSlackNotice({
      noticeKey,
      destination: origin.value.destination,
      text: `${access} You can review or revoke it in the connected service.`,
      now,
    });
  }
}

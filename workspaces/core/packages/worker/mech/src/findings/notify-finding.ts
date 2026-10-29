import type { FindingRow, WatchRow } from '@mechane/mech-store';
import { SlackDeliveryId } from '@mechane/records';
import { DateTime, Duration, Option } from 'effect';
import type { NowInput, TablesInput } from '../types.ts';
import { findingNotification } from './finding-notification.ts';

type NotifyFindingInput = TablesInput & NowInput & { readonly watch: WatchRow; readonly finding: FindingRow };

/** Queues a changed condition once its identity cooldown permits, in the reporting transaction. */
export function notifyFinding({ store, watch, finding, now }: NotifyFindingInput): FindingRow {
  if (Option.isNone(watch.notificationBindingId)) {
    return finding;
  }

  const sameFingerprint = Option.contains(finding.notifiedFingerprint, finding.fingerprint);
  const sameState = Option.contains(finding.notifiedState, finding.state);

  if (sameFingerprint && sameState) {
    return finding;
  }

  if (Option.isSome(finding.notifiedAt)) {
    const cooldown = Duration.seconds(watch.cooldownSeconds);
    const nextNotificationAt = DateTime.addDuration(finding.notifiedAt.value, cooldown);

    if (DateTime.isLessThan(now, nextNotificationAt)) {
      return finding;
    }
  }

  const deliveryId = SlackDeliveryId.make(crypto.randomUUID());
  const text = findingNotification({ watch, finding });

  store.enqueueSlackBindingDelivery({ deliveryId, bindingId: watch.notificationBindingId.value, text, now });

  return {
    ...finding,
    notifiedAt: Option.some(now),
    notifiedFingerprint: Option.some(finding.fingerprint),
    notifiedState: Option.some(finding.state),
  };
}

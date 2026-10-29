import type { Finding, Watch } from '@mechane/protocol';
import { DateTime } from 'effect';

type FindingNotificationInput = { readonly watch: Watch; readonly finding: Finding };

/** Formats the finding condition, observation window, and source links for its Slack audience. */
export function findingNotification({ watch, finding }: FindingNotificationInput): string {
  return [
    `${watch.name}: ${finding.change} — ${finding.key}`,
    finding.summary,
    `Evidence window: ${DateTime.formatIso(finding.windowStart)} to ${DateTime.formatIso(finding.windowEnd)}`,
    ...finding.evidence,
  ].join('\n');
}

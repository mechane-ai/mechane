import type { Watch } from '@mechane/protocol';
import { DateTime } from 'effect';

type WatchPromptInput = { readonly watch: Watch; readonly now: DateTime.Utc };

/** Requests one fresh evidence check within its deadline, without granting external mutation authority. */
export function watchPrompt({ watch, now }: WatchPromptInput): string {
  return [
    `Scheduled watch ${watch.id}: ${watch.name}. Scheduled at ${DateTime.formatIso(now)}.`,
    `Complete one fresh check within ${watch.maxCheckSeconds} seconds using only your current granted tools and budget.`,
    'Read current source state. Do not treat earlier conversation or findings as current evidence.',
    'Use report_finding for each meaningful finding, with a stable key and fingerprint, source links, and the observation window.',
    'Report unknown when evidence is missing or a source fails. Report recovered only when fresh evidence proves recovery.',
    'Report findings and recommendations. This watch grants no authority to repair, publish, release, or change an external system.',
    watch.prompt,
  ].join('\n');
}

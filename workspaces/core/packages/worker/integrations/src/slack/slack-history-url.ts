import { DateTime, Option } from 'effect';
import { SlackApiMethod } from './constants.ts';
import { slackApiUrl } from './slack-api-url.ts';
import type { SlackHistoryPageInput } from './types.ts';

const SLACK_HISTORY_PAGE_MESSAGES = 100;

const MILLISECONDS_PER_SECOND = 1000;
const HISTORY_CLOCK_SKEW_SECONDS = 300;

/** The thread or recent channel history window used for delivery reconciliation. */
export function slackHistoryUrl({ installation, destination, attemptedAt, cursor }: SlackHistoryPageInput): URL {
  const method = Option.match(destination.threadTimestamp, {
    onNone: () => SlackApiMethod.History,
    onSome: () => SlackApiMethod.Replies,
  });

  const url = slackApiUrl({ origin: installation.apiOrigin, method });

  const pageMessages = String(SLACK_HISTORY_PAGE_MESSAGES);
  const includeMetadata = String(true);

  url.searchParams.set('channel', destination.channelId);
  url.searchParams.set('limit', pageMessages);
  url.searchParams.set('include_all_metadata', includeMetadata);
  url.searchParams.set('cursor', cursor);

  if (Option.isSome(destination.threadTimestamp)) {
    url.searchParams.set('ts', destination.threadTimestamp.value);
  } else {
    const attemptedAtMs = DateTime.toEpochMillis(attemptedAt);
    const oldest = String(attemptedAtMs / MILLISECONDS_PER_SECOND - HISTORY_CLOCK_SKEW_SECONDS);

    url.searchParams.set('oldest', oldest);
  }

  return url;
}

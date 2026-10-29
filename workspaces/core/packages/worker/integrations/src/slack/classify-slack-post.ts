import type { SlackChannelId } from '@mechane/records';
import { Option } from 'effect';
import { SlackPostResult } from './schemas.ts';
import type { SlackResponse } from './schemas.ts';

type ClassifySlackPostInput = { readonly reply: SlackResponse; readonly channelId: SlackChannelId };

const SLACK_BLOCKED_ERRORS: ReadonlySet<string> = new Set([
  'invalid_auth',
  'token_revoked',
  'account_inactive',
  'missing_scope',
  'channel_not_found',
  'not_in_channel',
  'is_archived',
  'restricted_action',
  'no_permission',
]);

/** Treats only confirmed writes and known definitive refusals as settled outcomes. */
export function classifySlackPost({ reply, channelId }: ClassifySlackPostInput): SlackPostResult {
  const channel = Option.getOrElse(reply.channel, () => '');

  if (reply.isOk && Option.isSome(reply.ts) && channel === channelId) {
    return SlackPostResult.cases.Sent.make({ messageTimestamp: reply.ts.value });
  }

  const reason = Option.getOrElse(reply.error, () => 'response_incomplete');

  if (!reply.isOk && SLACK_BLOCKED_ERRORS.has(reason)) {
    return SlackPostResult.cases.Blocked.make({ reason });
  }

  return SlackPostResult.cases.Uncertain.make({ reason: 'slack_outcome_uncertain' });
}

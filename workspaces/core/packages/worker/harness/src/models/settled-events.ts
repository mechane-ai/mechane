import type { AssistantMessageEvent, Usage } from '@earendil-works/pi-ai';
import { BoundedCallStatus } from '@mechane/protocol';
import type { TokenUsage } from '@mechane/protocol';
import { Tokens } from '@mechane/records';
import { Option } from 'effect';
import type { SettleInput } from './types.ts';

/** The terminal events of a pi-ai stream, after which a dispatch settles. */
const PiEventType = { Done: 'done', Error: 'error' } as const;

type SettledEventsInput = {
  readonly events: AsyncIterable<AssistantMessageEvent>;
  readonly settle: (input: SettleInput) => Promise<void>;
};

type ReportedUsageInput = { readonly usage: Usage };

/**
 * The dispatch's events, which settle it before its last event passes on, so no turn or drone ends with it unsettled.
 *
 * @yields each event of the dispatch, the terminal one once the dispatch has settled
 */
export async function* settledEvents({ events, settle }: SettledEventsInput): AsyncGenerator<AssistantMessageEvent> {
  for await (const event of events) {
    if (event.type === PiEventType.Done) {
      const usage = reportedUsage({ usage: event.message.usage });
      const encoded = JSON.stringify(event.message);
      const responseJson = Option.some(encoded);

      await settle({ usage, responseJson, status: BoundedCallStatus.Completed });
    }

    if (event.type === PiEventType.Error) {
      const usage = reportedUsage({ usage: event.error.usage });
      const encoded = JSON.stringify(event.error);
      const responseJson = Option.some(encoded);

      await settle({ usage, responseJson, status: BoundedCallStatus.Failed });
    }

    yield event;
  }
}

/** The usage the upstream reported, none when it reported no tokens, as a stream cut before its usage leaves it. */
function reportedUsage({ usage }: ReportedUsageInput): Option.Option<TokenUsage> {
  const tokens = {
    inputTokens: Tokens.make(usage.input),
    outputTokens: Tokens.make(usage.output),
    cacheReadTokens: Tokens.make(usage.cacheRead),
    cacheWriteTokens: Tokens.make(usage.cacheWrite),
  };

  return Option.liftPredicate(tokens, () => usage.totalTokens > 0);
}

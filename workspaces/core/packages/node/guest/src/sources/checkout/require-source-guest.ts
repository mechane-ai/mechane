import type { SourceId } from '@mechane/records';
import { GuestScope } from '@mechane/sandbox-wire';
import { Effect, Option } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import type { GuestSettings } from '../../types.ts';

/** Local fixtures use plain HTTP and never authorize credentials for a live repository. */
const FIXTURE_PROTOCOL = 'http:';
/** Local Git fixtures may listen on any of the loopback host spellings. */
const FIXTURE_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

type RequireSourceGuestInput = {
  readonly sourceId: SourceId;
  readonly repositoryUrl: string;
  readonly scope: GuestSettings['scope'];
  readonly reason: string;
};

/** Live credentials require the container scope whose fresh checkout generation the controller establishes. */
export const requireSourceGuest = Effect.fn('requireSourceGuest')(function* ({
  sourceId,
  repositoryUrl,
  scope,
  reason,
}: RequireSourceGuestInput): Effect.fn.Return<void, SourceGuestFailed> {
  const parsed = URL.parse(repositoryUrl);
  const origin = Option.fromNullishOr(parsed);

  if (Option.isNone(origin)) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source repository URL is invalid' });
  }

  if (scope === GuestScope.Container) {
    return;
  }

  const isFixture = origin.value.protocol === FIXTURE_PROTOCOL && FIXTURE_HOSTS.has(origin.value.hostname);

  if (!isFixture) {
    return yield* new SourceGuestFailed({ sourceId, reason });
  }
});

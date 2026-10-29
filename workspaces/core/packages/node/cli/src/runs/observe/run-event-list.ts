import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandRunInput, RunFailure } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import { WAIT_MAX } from '@mechane/protocol';
import { Duration, Effect, Stream } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import type { EventPageInput } from './types.ts';
import { writeEventPage } from './write-event-page.ts';

/** How long a list of events that does not follow waits: not at all, so it ends at the end of the log. */
const LISTING_WAIT = Duration.zero;

/**
 * Writes a mech's events after the cursor, one record each, page by page. A listing ends at the end of the log; with
 * `--follow` each page waits for the next event, and the run goes on until a signal ends the process. A failed page
 * ends the run: a follower resumes with `--after` the last sequence it wrote.
 */
export const runEventList = Effect.fn('runEventList')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
  write,
}: CommandRunInput<'event list'>): Effect.fn.Return<RunOutcome, RunFailure> {
  const { mechId, after, isFollowing } = input;

  const wait: Duration.Duration = (() => {
    if (isFollowing) {
      return WAIT_MAX;
    }

    return LISTING_WAIT;
  })();

  yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: (access) => writeEvents({ call, access, mechId, after, isFollowing, wait, write }),
  });

  return RunOutcome.Completed;
});

/** Writes the events after `after`, one record each, a page at a time as each page arrives. */
const writeEvents = Effect.fn('writeEvents')(function* ({
  after,
  ...listing
}: EventPageInput): Effect.fn.Return<void, ClientFailure> {
  yield* Stream.runDrain(Stream.paginate(after, (cursor: number) => writeEventPage({ ...listing, after: cursor })));
});

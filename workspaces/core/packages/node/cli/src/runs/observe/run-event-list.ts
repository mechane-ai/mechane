import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandRunInput, RunFailure } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import { Effect, Stream } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import type { EventPageInput } from './types.ts';
import { writeEventPage } from './write-event-page.ts';

/** Streams retained events until the final page of the archive. */
export const runEventList = Effect.fn('runEventList')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
  write,
}: CommandRunInput<'history events'>): Effect.fn.Return<RunOutcome, RunFailure> {
  yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: (access) => writeEvents({ call, access, ...input, write }),
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

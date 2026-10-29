import type { ClientFailure } from '@mechane/client';
import { PROGRAM } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import type { EventPage } from '@mechane/protocol';
import { Effect } from 'effect';
import type { EventPageInput } from './types.ts';

/** A page of a mech's events to list after `after`, and how long it waits for one. */
type ListedEventsInput = Omit<EventPageInput, 'isFollowing' | 'write'>;

/** A page that failed, and the cursor it listed after, which every event through it was written up to. */
type NoteResumeInput = { readonly after: number; readonly failure: ClientFailure };

/** The page of a mech's events after `after`; a page that fails names the cursor to resume from. */
export const listedEvents = Effect.fn('listedEvents')(function* ({
  call,
  access,
  mechId,
  after,
  wait,
}: ListedEventsInput): Effect.fn.Return<EventPage, ClientFailure> {
  const { token, workspaceId } = access;

  const resume: (failure: ClientFailure) => Effect.Effect<never, ClientFailure> = (failure) =>
    noteResume({ after, failure });

  return yield* call({ name: 'listEvents', input: { workspaceId, mechId, after, wait }, credential: token }).pipe(
    Effect.catchTags({
      OperationFailed: resume,
      OriginUnreachable: resume,
      RequestTimedOut: resume,
      ResponseUnreadable: resume,
    }),
  );
});

/** Tells a person where to resume a listing whose page failed, then fails as the page did. */
const noteResume = Effect.fn('noteResume')(function* ({
  after,
  failure,
}: NoteResumeInput): Effect.fn.Return<never, ClientFailure> {
  writeDiagnostic({ program: PROGRAM, line: `listing the events after ${after} failed; resume with --after ${after}` });

  return yield* failure;
});

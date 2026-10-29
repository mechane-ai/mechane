import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { LiveDoc, ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { Harness, LiveState, SubmissionId } from '@earendil-works/pi-durable';
import { Option } from 'effect';

/** The opened Harness, and the submissions of the turn whose run stops. */
type StopRunInput = { readonly harness: Harness; readonly submissionIds: ReadonlyArray<SubmissionId> };

/** The run that settles a conversation's inputs while it is busy, by the task that settles them. */
type LiveRun = NonNullable<LiveState['run']>;

/**
 * Aborts the generation that holds the turn's run and waits for it, until none holds it. A run moves to a new
 * generation after each tool round, so a generation that handed it on is found again. A marked one cannot hand it on,
 * so its abort ends the run.
 */
export async function stopRun({ harness, submissionIds }: StopRunInput): Promise<void> {
  let run = await runHolding({ harness, submissionIds });

  while (Option.isSome(run)) {
    await harness.abortTask(run.value.taskId, BACKGROUND_CONTEXT);
    await harness.waitForTask(run.value.taskId, BACKGROUND_CONTEXT);

    run = await runHolding({ harness, submissionIds });
  }
}

/** The run of the mech's conversation that holds one of the submissions, none once no run holds any. */
async function runHolding({ harness, submissionIds }: StopRunInput): Promise<Option.Option<LiveRun>> {
  const live = Option.fromNullishOr(await harness.snapshot(LiveDoc, ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT));

  const holdsSubmission: (run: LiveRun) => boolean = ({ inputs }) =>
    inputs.some((input) => submissionIds.includes(input));

  return Option.filter(
    Option.flatMapNullishOr(live, (state) => state.run),
    holdsSubmission,
  );
}

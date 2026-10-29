import { REQUEST_TIMEOUT } from '@mechane/cli-kernel';
import type { CommandResult, RunFailure, RunInput, UpdateResult } from '@mechane/cli-kernel';
import { PROGRAM } from '@mechane/commands';
import { UpdateOutcome } from '@mechane/program';
import { Effect } from 'effect';
import { updateRelease } from './update-release.ts';

type UpdateLineInput = { readonly result: UpdateResult };

/**
 * Replaces a release's binary with the latest release its deployment publishes, unless it runs that release already or
 * `--check` asks only for a report.
 */
export const runUpdate = Effect.fn('runUpdate')(function* ({
  origin,
  input,
  program,
}: RunInput<'update'>): Effect.fn.Return<CommandResult<'update'>, RunFailure> {
  const { release, binary, userAgent } = program;

  const result = yield* updateRelease({
    origin,
    release,
    binary,
    userAgent,
    timeout: REQUEST_TIMEOUT,
    isCheckOnly: input.isCheckOnly,
  });

  return { lines: [updateLine({ result })], result };
});

/** What an update found or did, as a person reads it. */
function updateLine({ result }: UpdateLineInput): string {
  const { outcome, from, to, binary } = result;

  switch (outcome) {
    case UpdateOutcome.UpToDate:
      return `${binary} runs ${PROGRAM} ${from}, the latest release`;
    case UpdateOutcome.Available:
      return `${binary} runs ${PROGRAM} ${from}, and ${to} is the latest release; run ${PROGRAM} update to install it`;
    case UpdateOutcome.Updated:
      return `updated ${binary} from ${PROGRAM} ${from} to ${to}`;
  }
}

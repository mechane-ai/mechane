import { SUCCESS_STATUS } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { cliRefusal, cliResult, finishedCli } from '@mechane/testing';
import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import { binaryReport } from './binary-report.ts';
import { refusedInstall } from './refused-install.ts';
import { UpdateReport } from './schemas.ts';
import { tamperedRelease } from './tampered-release.ts';
import type { HostRelease, UpdateRuns } from './types.ts';

type UpdateRunsInput = {
  readonly stack: Stack;
  readonly folder: string;
  readonly binary: string;
  readonly published: HostRelease;
};

/**
 * Runs install.sh and the installed CLI's update against the later release with a corrupted binary. Once the release
 * itself is published, runs a check, an update and a second update, with what the binary reports after each.
 */
export const updateRuns = Effect.fn('updateRuns')(function* ({
  stack,
  folder,
  binary,
  published,
}: UpdateRunsInput): Effect.fn.Return<UpdateRuns, ScenarioFailure> {
  const update = { stack, binary, args: ['update'], environment: {} };
  const updateCheck = { ...update, args: ['update', '--check'] };
  const report = { result: UpdateReport, status: SUCCESS_STATUS };

  yield* tamperedRelease({ stack, folder, release: published });

  const installRefusal = yield* refusedInstall({ stack, folder });
  const refused = yield* cliRefusal({ ...update, run: yield* finishedCli(update) });
  const kept = yield* binaryReport({ stack, binary });

  yield* stack.publish({ folder: published.folder });

  const { result: checked } = yield* cliResult({ ...updateCheck, ...report, run: yield* finishedCli(updateCheck) });
  const { result: updated } = yield* cliResult({ ...update, ...report, run: yield* finishedCli(update) });
  const replaced = yield* binaryReport({ stack, binary });
  const { result: repeated } = yield* cliResult({ ...update, ...report, run: yield* finishedCli(update) });

  return { installRefusal, refused, kept, checked, updated, replaced, repeated };
});

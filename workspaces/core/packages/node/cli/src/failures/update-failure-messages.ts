import type { BinaryMismatch, UpdateFailure } from '@mechane/cli-kernel';
import { ExitStatus, PROGRAM } from '@mechane/commands';
import { Match, Option } from 'effect';
import { ownMessage } from './own-message.ts';
import type { FailureMessages } from './types.ts';

/** Why a binary is not its release's, under each tag of the mismatch; a tag without a reason fails to compile. */
type MismatchReasons = {
  readonly [T in BinaryMismatch['_tag']]: (mismatch: Extract<BinaryMismatch, Readonly<Record<'_tag', T>>>) => string;
};

/** Why a binary is not its release's, as each mismatch's fields say. */
const MISMATCH_REASONS: Readonly<MismatchReasons> = {
  SizeMismatched: ({ bytes, release, manifestBytes }) =>
    `it holds ${bytes} bytes, where release ${release} names ${manifestBytes}`,
  DigestMismatched: ({ sha256, release, manifestSha256 }) =>
    `its SHA-256 is ${sha256}, where release ${release} names ${manifestSha256}`,
  BinaryUnrunnable: ({ reason }) => `it does not run: ${reason}`,
  ReleaseMisreported: ({ reported, release }) => `it reports "${reported}", where it is ${PROGRAM} ${release}`,
};

/** The report of each way an update fails beside its requests, under its tag; each leaves the binary as it was. */
export const UPDATE_FAILURE_MESSAGES: Readonly<FailureMessages<UpdateFailure>> = {
  ReleaseStampMissing: ({ _tag, release, installScriptUrl }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Failed,
      message: `this ${PROGRAM} ${release} is no release's binary, such as a run from source`,
      next: Option.some(`install a release with curl -fsSL ${installScriptUrl.href} | sh`),
    }),
  TargetUnpublished: ({ _tag, release, target }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.ForbiddenOrNotFound,
      message: `release ${release} publishes no binary for ${target}`,
      next: Option.some('the binary stays as it was'),
    }),
  BinaryMismatched: ({ _tag, url, mismatch }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Failed,
      message: `the binary at ${url.href} is not its release's: ${Match.valueTags(mismatch, MISMATCH_REASONS)}`,
      next: Option.some('the binary stays as it was, so try again later'),
    }),
  ReplaceFailed: ({ _tag, step, path, reason }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Failed,
      message: `${step} ${path}: ${reason}`,
      next: Option.some('check that you may write its folder'),
    }),
};

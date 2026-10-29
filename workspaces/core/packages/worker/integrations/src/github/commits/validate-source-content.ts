import { Bytes } from '@mechane/records';
import type { SourceChange } from '@mechane/records';
import { Option, Result } from 'effect';
import { Base64 } from 'effect/encoding';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';
import type { GitHubTreeEntry } from './schemas.ts';

type ValidateSourceContentInput = {
  readonly change: SourceChange;
  /** None means the path does not exist in the immutable base tree. */
  readonly original: Option.Option<GitHubTreeEntry>;
};

type ValidateSourceBytesInput = { readonly base64: string };

/** A deletion needs both absent fields and an existing file; content must use canonical base64. */
export function validateSourceContent({
  change,
  original,
}: ValidateSourceContentInput): Result.Result<Bytes, GitHubFailed> {
  const { mode, base64 } = change;

  if (Option.isSome(mode) && Option.isSome(base64)) {
    return validateSourceBytes({ base64: base64.value });
  }

  if (Option.isSome(mode) || Option.isSome(base64) || Option.isNone(original)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'source patch has an invalid deletion' });
  }

  const bytes = Bytes.make(0);

  return Result.succeed(bytes);
}

function validateSourceBytes({ base64 }: ValidateSourceBytesInput): Result.Result<Bytes, GitHubFailed> {
  const content = Base64.decode(base64);

  if (Result.isFailure(content)) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'source patch exceeds its limit or has invalid content',
    });
  }

  const canonical = Base64.encode(content.success);

  if (canonical !== base64) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'source patch exceeds its limit or has invalid content',
    });
  }

  const bytes = Bytes.make(content.success.byteLength);

  return Result.succeed(bytes);
}

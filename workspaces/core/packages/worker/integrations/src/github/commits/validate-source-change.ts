import type { SourceGrant } from '@mechane/protocol';
import { Bytes, SOURCE_PATCH_MAX_BYTES } from '@mechane/records';
import type { SourceChange } from '@mechane/records';
import { Result } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';
import type { GitHubTreeEntry } from './schemas.ts';
import type { SourceValidation } from './types.ts';
import { validateSourceContent } from './validate-source-content.ts';
import { validateSourcePath } from './validate-source-path.ts';

type ValidateSourceChangeInput = {
  readonly grant: SourceGrant;
  readonly change: SourceChange;
  readonly known: ReadonlyMap<string, GitHubTreeEntry>;
  readonly validation: SourceValidation;
};

type ExtendSourceValidationInput = {
  readonly validation: SourceValidation;
  readonly path: string;
  readonly contentBytes: Bytes;
};

/** Preserves patch-order refusal checks before accepting the next path and byte count. */
export function validateSourceChange({
  grant,
  change,
  known,
  validation,
}: ValidateSourceChangeInput): Result.Result<SourceValidation, GitHubFailed> {
  if (validation.seen.has(change.path)) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'source patch includes an ungranted or protected path',
    });
  }

  const original = validateSourcePath({ grant, path: change.path, known });

  if (Result.isFailure(original)) {
    return Result.fail(original.failure);
  }

  const content = validateSourceContent({ change, original: original.success });

  if (Result.isFailure(content)) {
    return Result.fail(content.failure);
  }

  return extendSourceValidation({ validation, path: change.path, contentBytes: content.success });
}

function extendSourceValidation({
  validation,
  path,
  contentBytes,
}: ExtendSourceValidationInput): Result.Result<SourceValidation, GitHubFailed> {
  const totalBytes = validation.totalBytes + contentBytes;

  if (totalBytes > SOURCE_PATCH_MAX_BYTES) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'source patch exceeds its limit or has invalid content',
    });
  }

  const seen = new Set([...validation.seen, path]);

  const bytes = Bytes.make(totalBytes);

  return Result.succeed({ seen, totalBytes: bytes });
}

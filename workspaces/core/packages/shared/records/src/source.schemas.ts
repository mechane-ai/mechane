import { Schema } from 'effect';
import { RecordId } from './schemas.ts';
import {
  SOURCE_BASE64_EXPANSION_FACTOR,
  SOURCE_PATCH_MAX_BYTES,
  SOURCE_PATCH_MAX_FILES,
  SOURCE_PATH_MAX_CHARS,
  SOURCE_ROOT_PATH,
  SourceFileMode,
} from './source.constants.ts';

/** One identity pins a checkout and its single immutable publication intent. */
export const SourceId = RecordId.pipe(Schema.brand('SourceId'));
export type SourceId = typeof SourceId.Type;

/** Full SHA-1 object IDs prevent a branch move from changing a recorded baseline. */
export const GitCommit = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u));
export type GitCommit = typeof GitCommit.Type;

/** Paths stay inside the repository and cannot target Git metadata. */
export const SourcePath = Schema.NonEmptyString.check(
  Schema.isMaxLength(SOURCE_PATH_MAX_CHARS),
  Schema.isPattern(
    /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*(?:^|\/)\.git(?:\/|$))(?!.*[\\\\\p{Cc}])[^/]+(?:\/[^/]+)*$/iu,
  ),
);

export type SourcePath = typeof SourcePath.Type;

/** Owners can approve one subtree or the repository root. */
export const SourcePathPrefix = Schema.Union([Schema.Literal(SOURCE_ROOT_PATH), SourcePath]);
export type SourcePathPrefix = typeof SourcePathPrefix.Type;

/** Captured bytes describe a regular-file replacement or deletion without trusting guest Git objects. */
export const SourceChange = Schema.Struct({
  path: SourcePath,
  /** Absent mode marks a deletion and requires absent content. */
  mode: Schema.OptionFromNullOr(Schema.Enum(SourceFileMode)),
  /** Absent content marks a deletion; empty base64 instead represents an empty file. */
  base64: Schema.OptionFromNullOr(
    Schema.String.check(Schema.isMaxLength(SOURCE_PATCH_MAX_BYTES * SOURCE_BASE64_EXPANSION_FACTOR)),
  ),
});

export type SourceChange = typeof SourceChange.Type;

/** The file-count bound applies before the trusted publisher validates aggregate bytes. */
export const SourceChanges = Schema.Array(SourceChange).check(Schema.isMaxLength(SOURCE_PATCH_MAX_FILES));
export type SourceChanges = typeof SourceChanges.Type;

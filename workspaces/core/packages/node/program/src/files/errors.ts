import { Schema } from 'effect';
import { FileStep } from './constants.ts';

/** A step that puts a file at its path failed; `path` names the file the step wrote, renamed, linked or removed. */
export class FileWriteFailed extends Schema.TaggedError<FileWriteFailed>()('FileWriteFailed', {
  step: Schema.Enum(FileStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

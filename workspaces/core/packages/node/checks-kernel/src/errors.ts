import { Schema } from 'effect';

/** A check could not read an input it needs, such as a missing or malformed configuration file. */
export class InputUnreadable extends Schema.TaggedError<InputUnreadable>()('InputUnreadable', {
  path: Schema.String,
  reason: Schema.String,
}) {}

/** A command could not write a file it keeps for a later run, such as the module graph or the green fingerprint. */
export class FileUnwritable extends Schema.TaggedError<FileUnwritable>()('FileUnwritable', {
  path: Schema.String,
  reason: Schema.String,
}) {}

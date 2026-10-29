import { Schema } from 'effect';
import { FileStep } from './constants.ts';

/** A pass could not list, read, write or decode a file or folder of the factory. */
export class FileFailed extends Schema.TaggedError<FileFailed>()('FileFailed', {
  step: Schema.Enum(FileStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

/** A file move of a map failed, relative to the workspace. */
export class MoveFailed extends Schema.TaggedError<MoveFailed>()('MoveFailed', {
  from: Schema.String,
  to: Schema.String,
  reason: Schema.String,
}) {}

/** A binding's rename would move its file onto a file of the workspace, relative to it. */
export class MoveTaken extends Schema.TaggedError<MoveTaken>()('MoveTaken', {
  from: Schema.String,
  to: Schema.String,
}) {}

/** The command line names no binding and new name, with the file when two files declare it. */
export class NamesRefused extends Schema.TaggedError<NamesRefused>()('NamesRefused', {
  names: Schema.Array(Schema.String),
}) {}

/** No TypeScript file of the workspace declares the binding. */
export class DeclarationMissing extends Schema.TaggedError<DeclarationMissing>()('DeclarationMissing', {
  name: Schema.String,
}) {}

/** More than one file declares the binding, by their paths relative to the workspace. */
export class DeclarationShared extends Schema.TaggedError<DeclarationShared>()('DeclarationShared', {
  name: Schema.String,
  paths: Schema.Array(Schema.String),
}) {}

/** The language server renames nothing at an identifier's declaration, in its file relative to the workspace. */
export class NothingRenamed extends Schema.TaggedError<NothingRenamed>()('NothingRenamed', {
  name: Schema.String,
  file: Schema.String,
}) {}

/** The language server refused to start. */
export class ServerRefused extends Schema.TaggedError<ServerRefused>()('ServerRefused', { reason: Schema.String }) {}

/** The language server exited while a request waited, with the status its process ended with. */
export class ServerExited extends Schema.TaggedError<ServerExited>()('ServerExited', { status: Schema.String }) {}

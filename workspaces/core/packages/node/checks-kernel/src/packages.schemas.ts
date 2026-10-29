import { MemberManifest } from '@mechane/rule-shapes';
import { Schema } from 'effect';

/**
 * A path of the map, relative to the workspace: letters, digits, `_`, `-`, `.` and `/` only, so the path pass matches
 * it as written.
 */
const MapPath = Schema.String.check(Schema.isPattern(/^[\w./-]+$/));

/**
 * Files to move, relative to the workspace: a folder's files when `from` ends with a slash, each to the same path below
 * `to`, or one file.
 */
const PathMove = Schema.Struct({ from: MapPath, to: MapPath });

/** Declarations to move from one role file to another before the files move, both by their paths before the step. */
const DeclarationMove = Schema.Struct({ from: MapPath, to: MapPath, names: Schema.NonEmptyArray(Schema.String) });

/**
 * One step of the move map: the manifest entries it writes, the declarations it moves first, and the files it moves. A
 * step applied once moves nothing more.
 */
const MoveStep = Schema.Struct({
  name: Schema.NonEmptyString,
  members: MemberManifest,
  declarations: Schema.Array(DeclarationMove),
  moves: Schema.NonEmptyArray(PathMove),
});

/** The move map: the steps that take the tree to the package map, in the order they apply. */
export const MoveMap = Schema.fromJsonString(Schema.Struct({ steps: Schema.NonEmptyArray(MoveStep) }));

export type MoveMap = typeof MoveMap.Type;

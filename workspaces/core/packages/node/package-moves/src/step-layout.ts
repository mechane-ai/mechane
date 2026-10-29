import { decodeFile, movedPath } from '@mechane/checks-kernel';
import type { InputUnreadable, Member, MoveStep, PathMove } from '@mechane/checks-kernel';
import { Array, Effect, Option, Record, Schema } from 'effect';
import { posix } from 'node:path';
import { MEMBER_SCOPE, PACKAGE_MANIFEST } from './constants.ts';
import { MoveRefused } from './errors.ts';
import type { PlacedMember, StepLayout } from './packages.types.ts';

/** The folder that holds each lane's folder of packages, as `packages/<lane>/<name>`. */
const PACKAGES_FOLDER = 'packages';

/** The part of the root's package manifest the layout reads: the root's name. */
const PackageName = Schema.Struct({ name: Schema.String });

/** A member the step names, by its package name, with its row. */
type StepMemberEntry = readonly [string, MoveStep['members'][string]];

/** A file's path before the step, and the path the step lands it on. */
type FileLanding = { readonly path: string; readonly to: string };

/** A step's moves, and every file git tracks before it, relative to the workspace. */
type LandingRefusalInput = { readonly moves: ReadonlyArray<PathMove>; readonly files: ReadonlyArray<string> };

/** A step, the workspace's members before it, and every file git tracks, relative to the workspace. */
type StepLayoutInput = {
  readonly step: MoveStep;
  readonly members: ReadonlyArray<Member>;
  readonly files: ReadonlyArray<string>;
};

/**
 * Where a step leaves the tree. A member's folder follows its manifest, and a member the step adds takes
 * `packages/<lane>/<name>`. A step that lands a file on a path some file holds before it, or two files on one path, is
 * refused.
 */
export const stepLayout = Effect.fn('stepLayout')(function* ({
  step,
  members,
  files,
}: StepLayoutInput): Effect.fn.Return<StepLayout, InputUnreadable | MoveRefused> {
  const { moves } = step;
  const refusal = landingRefusal({ moves, files });

  if (Option.isSome(refusal)) {
    return yield* refusal.value;
  }

  /** A member's folder after the step: the folder its manifest lands in. */
  const placedMember: (member: Member) => PlacedMember = ({ name, folder }) => ({
    name,
    folder: posix.dirname(movedPath({ moves, path: posix.join(folder, PACKAGE_MANIFEST) })),
  });

  const placed = members.filter(({ folder }) => folder !== '').map(placedMember);
  const existing: ReadonlySet<string> = new Set(members.map(({ name }) => name));

  /** Whether the step adds the member, which the workspace does not hold before it. */
  const isAdded: (entry: StepMemberEntry) => boolean = ([name]) => !existing.has(name);

  /** The folder of a member the step adds, under its lane's folder of packages. */
  const addedMember: (entry: StepMemberEntry) => PlacedMember = ([name, { lane }]) => ({
    name,
    folder: posix.join(PACKAGES_FOLDER, lane, name.slice(MEMBER_SCOPE.length)),
  });

  const added: ReadonlyArray<PlacedMember> = Record.toEntries(step.members).filter(isAdded).map(addedMember);

  const { name } = yield* decodeFile({ path: PACKAGE_MANIFEST, schema: PackageName });

  return { moves, root: { name, folder: '' }, packages: [...placed, ...added] };
});

/** The refusal of a step that lands a file where a file stands before it, or two files on one path; none else. */
function landingRefusal({ moves, files }: LandingRefusalInput): Option.Option<MoveRefused> {
  const present: ReadonlySet<string> = new Set(files);

  /** The file's path, and the path the step lands it on. */
  const fileLanding: (path: string) => FileLanding = (path) => ({ path, to: movedPath({ moves, path }) });
  const moved = files.map(fileLanding).filter(({ path, to }) => to !== path);
  const taken = Array.findFirst(moved, ({ to }) => present.has(to));
  const shared = Array.findFirst([...Map.groupBy(moved, ({ to }) => to)], ([, group]) => group.length > 1);

  /** The refusal of a file that lands where a file stands. */
  const takenRefusal: (landing: FileLanding) => MoveRefused = ({ path, to }) =>
    new MoveRefused({ path: to, reason: `${path} would land on a file there` });

  /** The refusal of the files that land on one path. */
  const sharedRefusal: (group: readonly [string, ReadonlyArray<FileLanding>]) => MoveRefused = ([to, group]) => {
    const paths = group.map(({ path }) => path).join(' and ');

    return new MoveRefused({ path: to, reason: `${paths} would both land there` });
  };

  return Option.orElse(Option.map(taken, takenRefusal), () => Option.map(shared, sharedRefusal));
}

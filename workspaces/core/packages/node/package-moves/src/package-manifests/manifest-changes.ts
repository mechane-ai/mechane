import { movedPath } from '@mechane/checks-kernel';
import type { FileChange, InputUnreadable, Member } from '@mechane/checks-kernel';
import { Effect, Option, Record } from 'effect';
import { posix } from 'node:path';
import { PACKAGE_MANIFEST } from '../constants.ts';
import type { MoveRefused } from '../errors.ts';
import { memberOf } from '../member-of.ts';
import type { PlacedMember, RewrittenSource, StepLayout } from '../packages.types.ts';
import { heldManifest } from './held-manifest.ts';
import { memberImports } from './member-imports.ts';
import { readManifest } from './read-manifest.ts';

/** The layout, the members before the step, every TypeScript file after it, and every file git tracks before it. */
type ManifestsInput = {
  readonly layout: StepLayout;
  readonly members: ReadonlyArray<Member>;
  readonly sources: ReadonlyArray<RewrittenSource>;
  readonly files: ReadonlyArray<string>;
};

/** The files of a member's folder that hold no source, so a member left with only these is emptied. */
const PACKAGE_FILES: ReadonlySet<string> = new Set([PACKAGE_MANIFEST, 'tsconfig.json']);

/** What the step writes of the members' manifests, and the names of the members it empties. */
type ManifestChanges = { readonly changes: ReadonlyArray<FileChange>; readonly emptied: ReadonlyArray<string> };

/** The step's layout, a member's folder after it, and every file after it. */
type HoldsSourceInput = { readonly layout: StepLayout; readonly folder: string; readonly after: ReadonlyArray<string> };

/**
 * Each member's manifest after the step, the root's among them while it holds source, written where its dependencies
 * change. A member left with only its manifest, its compiler configuration and files the step empties is emptied, and
 * its manifest and configuration go. A member's folder that holds another member does not hold that member's files.
 */
export const manifestChanges = Effect.fn('manifestChanges')(function* (
  input: ManifestsInput,
): Effect.fn.Return<ManifestChanges, InputUnreadable | MoveRefused> {
  const { layout, members, sources, files } = input;
  const read = yield* Effect.forEach(members, (member) => readManifest({ member }), { concurrency: 1 });
  const manifests = new Map(read.map((manifest) => [manifest.member.name, manifest]));

  const versions = new Map(
    read.flatMap(({ declared }) => Record.toEntries({ ...declared.devDependencies, ...declared.dependencies })),
  );

  const blank: ReadonlySet<string> = new Set(sources.filter(({ text }) => text === '').map(({ path }) => path));

  /** Whether the file holds text after the step. */
  const isWritten: (path: string) => boolean = (path) => !blank.has(path);

  const after = [
    ...files.map((path) => movedPath({ moves: layout.moves, path })),
    ...sources.map(({ path }) => path),
  ].filter(isWritten);

  const held = layout.packages.filter(({ folder }) => holdsSource({ layout, folder, after }));

  /** Whether the step empties the member. */
  const isEmptied: (member: PlacedMember) => boolean = (member) => !held.includes(member);
  const emptied = layout.packages.filter(isEmptied);
  const imports = memberImports({ layout, sources });

  const written = yield* Effect.forEach(
    [layout.root, ...held],
    (member) => heldManifest({ ...input, member, manifests, imports, versions }),
    { concurrency: 1 },
  );

  /** The deletion of an emptied member's manifest and compiler configuration. */
  const packageFiles: (member: PlacedMember) => ReadonlyArray<FileChange> = ({ folder }) => {
    /** The deletion of one of the member's package files. */
    const deletion: (file: string) => FileChange = (file) => ({ path: posix.join(folder, file), text: Option.none() });

    return [...PACKAGE_FILES].map(deletion);
  };

  return { changes: [...emptied.flatMap(packageFiles), ...written.flat()], emptied: emptied.map(({ name }) => name) };
});

/** Whether a member holds a file after the step besides its manifest and compiler configuration. */
function holdsSource({ layout, folder, after }: HoldsSourceInput): boolean {
  /** Whether the file is the member's, and not one of its package files. */
  const isSource: (path: string) => boolean = (path) =>
    memberOf({ layout, path }).folder === folder && !PACKAGE_FILES.has(posix.relative(folder, path));

  return after.some(isSource);
}

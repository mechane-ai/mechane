import type { FileChange } from '@mechane/checks-kernel';
import { JSON_INDENT_CHARS, relativeSpecifier } from '@mechane/program';
import { Effect, Option } from 'effect';
import { posix } from 'node:path';
import { PACKAGE_MANIFEST } from '../constants.ts';
import type { MoveRefused } from '../errors.ts';
import type { PlacedMember, RewrittenSource, StepLayout } from '../packages.types.ts';
import { ENTRY_PATH } from './constants.ts';
import { isLost } from './is-lost.ts';
import { listedManifest } from './listed-manifest.ts';
import { nextDependencies } from './next-dependencies.ts';
import type { ReadManifest } from './types.ts';

/** A member after the step, each manifest before it, the packages each member imports, and every pinned version. */
type HeldManifestInput = {
  readonly layout: StepLayout;
  readonly sources: ReadonlyArray<RewrittenSource>;
  readonly files: ReadonlyArray<string>;
  readonly member: PlacedMember;
  readonly manifests: ReadonlyMap<string, ReadManifest>;
  readonly imports: ReadonlyMap<string, ReadonlySet<string>>;
  readonly versions: ReadonlyMap<string, string>;
};

/** A member the step adds, its dependencies, and every TypeScript file after the step, its entry among them or not. */
type AddedManifestInput = {
  readonly member: PlacedMember;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly sources: ReadonlyArray<RewrittenSource>;
};

/**
 * A member's manifest when its dependencies change: a file it lost may prune them, a new import extends them, and a
 * list the step empties goes. A member the step adds declares the packages its files import and exports its entry when
 * it has one.
 */
export const heldManifest = Effect.fn('heldManifest')(function* ({
  layout,
  sources,
  files,
  member,
  manifests,
  imports,
  versions,
}: HeldManifestInput): Effect.fn.Return<ReadonlyArray<FileChange>, MoveRefused> {
  const before = Option.fromNullishOr(manifests.get(member.name));
  const declared = Option.match(before, { onNone: () => ({}), onSome: (read) => ({ ...read.declared.dependencies }) });

  const developed = Option.match(before, {
    onNone: () => ({}),
    onSome: (read) => ({ ...read.declared.devDependencies }),
  });

  const isPruned = Option.exists(before, (read) => isLost({ layout, files, member, before: read.member, manifests }));
  const imported = Option.getOrElse(Option.fromNullishOr(imports.get(member.folder)), () => new Set<string>());
  const lists = yield* nextDependencies({ member, declared, developed, imported, isPruned, versions });
  const listed = { dependencies: declared, devDependencies: developed };

  if (Option.isSome(before) && JSON.stringify(lists) === JSON.stringify(listed)) {
    return [];
  }

  const manifest = Option.match(before, {
    onNone: () => addedManifest({ member, dependencies: lists.dependencies, sources }),
    onSome: (read) => listedManifest({ manifest: read.manifest, lists }),
  });

  const text = `${JSON.stringify(manifest, null, JSON_INDENT_CHARS)}\n`;

  return [{ path: posix.join(member.folder, PACKAGE_MANIFEST), text: Option.some(text) }];
});

/** The manifest of a member the step adds: private, a module, its entry when it has one, and its dependencies. */
function addedManifest({ member, dependencies, sources }: AddedManifestInput): Readonly<Record<string, unknown>> {
  const entry = posix.join(member.folder, ENTRY_PATH);

  if (sources.some(({ path }) => path === entry)) {
    const exported = relativeSpecifier({ importer: PACKAGE_MANIFEST, target: ENTRY_PATH });

    return { name: member.name, private: true, type: 'module', exports: { '.': exported }, dependencies };
  }

  return { name: member.name, private: true, type: 'module', dependencies };
}

import { MemberManifest } from '@mechane/rule-shapes';
import { CONTRACTS } from '@mechane/rules';
import type { WorkspaceMember } from '@mechane/rules';
import { Array, Effect, Option, Record, Schema } from 'effect';
import { existsSync, globSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readInput } from './read-input.ts';

/** The member manifest, relative to the workspace, whose lanes, layers and confines the configurations follow. */
const MEMBER_MANIFEST = 'dependencies.json';

/** The file that lists the workspace's member folders as globs, relative to the workspace. */
const WORKSPACE_FILE = 'pnpm-workspace.yaml';

/** A member's package manifest in its folder, whose name is the member's. */
const PACKAGE_MANIFEST = 'package.json';

const DEFINITION_EXPORTS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  CONTRACTS['package-layers'].values.definitionExports;

const MEMBER_SOURCE_FOLDERS: Readonly<Record<string, ReadonlyArray<string>>> =
  CONTRACTS['package-layers'].values.memberSourceFolders;

/** The part of pnpm-workspace.yaml the generator reads: the globs of the member folders. */
const WorkspaceFolders = Schema.Struct({ packages: Schema.Array(Schema.String) });

/** The package's exports stay explicit so the generated boundaries allow only declared public files. */
const PackageManifest = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    exports: Schema.OptionFromOptionalKey(Schema.Record(Schema.String, Schema.String)),
  }),
);

/** A package folder of the workspace, relative to it, and the manifest whose entry its package may have. */
type PackageMemberInput = { readonly folder: string; readonly manifest: MemberManifest };

/**
 * Every member `dependencies.json` declares that holds a package in the workspace: the root, and each folder a glob of
 * pnpm-workspace.yaml matches whose `package.json` names the member. A member without a package is the boundaries
 * check's finding, and a manifest key the schema does not name fails the read.
 */
export const readMembers = Effect.fn('readMembers')(function* (): Effect.fn.Return<
  ReadonlyArray<WorkspaceMember>,
  GenerateFailed
> {
  const manifest = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(MemberManifest), {
    onExcessProperty: 'error',
  })(yield* readInput({ path: MEMBER_MANIFEST })).pipe(
    Effect.mapError(
      (error) => new GenerateFailed({ step: GenerateStep.Read, path: MEMBER_MANIFEST, reason: error.message }),
    ),
  );

  const workspace = yield* readInput({ path: WORKSPACE_FILE });

  const globs = yield* Effect.try({
    try: (): unknown => parseYaml(workspace),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path: WORKSPACE_FILE, reason: String(cause) }),
  });

  const { packages } = yield* Schema.decodeUnknownEffect(WorkspaceFolders)(globs).pipe(
    Effect.mapError(
      (error) => new GenerateFailed({ step: GenerateStep.Read, path: WORKSPACE_FILE, reason: error.message }),
    ),
  );

  const manifests = globSync(
    packages.map((pattern) => posix.join(pattern, PACKAGE_MANIFEST)),
    { cwd: WORKSPACE_FOLDER },
  );

  const folders = ['', ...manifests.map((path) => dirname(path)).toSorted()];
  const members = yield* Effect.forEach(folders, (folder) => packageMember({ folder, manifest }), { concurrency: 1 });

  return Array.getSomes(members);
});

/**
 * The member a package folder holds, with the source roots its program includes, the folders of `sourceFolders` it
 * holds; none for a package the manifest does not declare.
 */
const packageMember = Effect.fn('packageMember')(function* ({
  folder,
  manifest,
}: PackageMemberInput): Effect.fn.Return<Option.Option<WorkspaceMember>, GenerateFailed> {
  const path = posix.join(folder, PACKAGE_MANIFEST);

  const { name, exports: declaredExports } = yield* Schema.decodeUnknownEffect(PackageManifest)(
    yield* readInput({ path }),
  ).pipe(Effect.mapError((error) => new GenerateFailed({ step: GenerateStep.Read, path, reason: error.message })));

  const exports = Option.getOrElse(declaredExports, () => ({}));
  const { libraryExports } = CONTRACTS['package-layers'].values;
  const packageDefinitions = Record.get(DEFINITION_EXPORTS, name);
  const definitions = Option.getOrElse(packageDefinitions, () => ({}));
  const allowed: Readonly<Record<string, string>> = { ...libraryExports, ...definitions };

  const isUnsupported: (entry: readonly [string, string]) => boolean = ([subpath, target]) =>
    allowed[subpath] !== target;

  if (Record.toEntries(exports).some(isUnsupported)) {
    const example = JSON.stringify(allowed);

    return yield* new GenerateFailed({
      step: GenerateStep.Read,
      path,
      reason: `Export only the package root or its registered defining modules, such as ${example}`,
    });
  }

  const isPresent: (root: string) => boolean = (root) => existsSync(join(WORKSPACE_FOLDER, root));

  const memberSources = Record.get(MEMBER_SOURCE_FOLDERS, name);

  const sources = Option.getOrElse(memberSources, () => CONTRACTS['package-layers'].values.sourceFolders);

  const roots = sources.map((source) => posix.join(folder, source)).filter(isPresent);

  const packageFolder = join(WORKSPACE_FOLDER, folder);

  const storyPatterns = sources.map((source) => posix.join(source, '**/*.stories.tsx'));
  const hasStories = globSync(storyPatterns, { cwd: packageFolder }).length > 0;

  return Option.map(Record.get(manifest, name), (entry) => ({ name, folder, roots, exports, hasStories, entry }));
});

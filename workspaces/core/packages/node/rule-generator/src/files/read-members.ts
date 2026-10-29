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

/** The part of pnpm-workspace.yaml the generator reads: the globs of the member folders. */
const WorkspaceFolders = Schema.Struct({ packages: Schema.Array(Schema.String) });

/** The part of a package manifest the generator reads: its package's name. */
const PackageName = Schema.fromJsonString(Schema.Struct({ name: Schema.String }));

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

  const { name } = yield* Schema.decodeUnknownEffect(PackageName)(yield* readInput({ path })).pipe(
    Effect.mapError((error) => new GenerateFailed({ step: GenerateStep.Read, path, reason: error.message })),
  );

  const isPresent: (root: string) => boolean = (root) => existsSync(join(WORKSPACE_FOLDER, root));

  const roots = CONTRACTS['package-layers'].values.sourceFolders
    .map((source) => posix.join(folder, source))
    .filter(isPresent);

  return Option.map(Record.get(manifest, name), (entry) => ({ name, folder, roots, entry }));
});

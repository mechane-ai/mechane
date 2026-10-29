import { CONTRACTS } from '@mechane/rules';
import { Effect, Predicate, Record, Schema } from 'effect';
import { globSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { WORKSPACE_FOLDER } from '../constants.ts';
import { decodeFile } from '../decode-file.ts';
import { InputUnreadable } from '../errors.ts';
import type { Member } from '../types.ts';

/** The file that lists the workspace's member folders as globs. */
const WORKSPACE_FILE = 'pnpm-workspace.yaml';

/** The folders of a member that hold its source; each one present is a source root. */
const SOURCE_FOLDERS: ReadonlySet<string> = new Set(CONTRACTS['package-layers'].values.sourceFolders);

/** The version range pnpm gives a dependency on another member of the workspace. */
const WORKSPACE_RANGE = 'workspace:';

/** Each member's compiler configuration, beside its manifest. */
const COMPILER_CONFIGURATION = 'tsconfig.json';

/** Each member's package manifest, which names it and its dependencies. */
const PACKAGE_MANIFEST = 'package.json';

/** The part of pnpm-workspace.yaml that names the member folders. */
const WorkspaceFile = Schema.Struct({ packages: Schema.Array(Schema.String) });

/** The parts of a package manifest that name it and its dependencies. */
const Manifest = Schema.Struct({
  name: Schema.String,
  dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  devDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

/** The part of a member's compiler configuration that names its lane's program and the folders it includes. */
const CompilerIncludes = Schema.Struct({ extends: Schema.String, include: Schema.Array(Schema.String) });

/** The part of a lane's program that names the files every member of the lane includes, its strict globals. */
const LaneFiles = Schema.Struct({ files: Schema.Array(Schema.String) });

type MemberInput = { readonly folder: string };

/** One dependency of a manifest, by its package name, and the version range it asks. */
type Dependency = readonly [name: string, range: string];

/** The workspace root and every folder a glob of pnpm-workspace.yaml matches that holds a manifest. */
export const workspaceMembers = Effect.fn('workspaceMembers')(function* (): Effect.fn.Return<
  ReadonlyArray<Member>,
  InputUnreadable
> {
  const { packages } = yield* decodeFile({ path: WORKSPACE_FILE, schema: WorkspaceFile });
  const patterns = packages.map((pattern) => posix.join(pattern, PACKAGE_MANIFEST));

  const manifests = yield* Effect.try({
    try: () => globSync(patterns, { cwd: WORKSPACE_FOLDER }),
    catch: (cause) => new InputUnreadable({ path: WORKSPACE_FILE, reason: String(cause) }),
  });

  const folders = manifests.map((manifest) => dirname(manifest)).toSorted();

  return yield* Effect.forEach(['', ...folders], (folder) => readMember({ folder }), { concurrency: 1 });
});

/** One member: its manifest's name and dependencies, its source roots, and the folders its lane's program includes. */
const readMember = Effect.fn('readMember')(function* ({
  folder,
}: MemberInput): Effect.fn.Return<Member, InputUnreadable> {
  const manifest = yield* decodeFile({ path: join(folder, PACKAGE_MANIFEST), schema: Manifest });

  const { extends: program, include } = yield* decodeFile({
    path: join(folder, COMPILER_CONFIGURATION),
    schema: CompilerIncludes,
  });

  const { files } = yield* decodeFile({ path: join(folder, program), schema: LaneFiles });
  const ranges = Record.toEntries({ ...manifest.dependencies, ...manifest.devDependencies });
  const absolute = join(WORKSPACE_FOLDER, folder);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(absolute, { withFileTypes: true }),
    catch: (cause) => new InputUnreadable({ path: folder, reason: String(cause) }),
  });

  const isSourceRoot: (entry: Dirent) => boolean = (entry) => entry.isDirectory() && SOURCE_FOLDERS.has(entry.name);
  const isInstalled: (dependency: Dependency) => boolean = ([, range]) => !range.startsWith(WORKSPACE_RANGE);
  const programFolder = dirname(join(folder, program));

  return {
    name: manifest.name,
    folder,
    internal: ranges.filter(Predicate.not(isInstalled)).map(([name]) => name),
    external: ranges.filter(isInstalled).map(([name]) => name),
    sourceRoots: entries.filter(isSourceRoot).map((entry) => join(folder, entry.name)),
    includedRoots: [
      ...include.map((included) => join(folder, included)),
      ...files.map((file) => join(programFolder, file)),
    ],
  };
});

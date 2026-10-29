import { PackageKind } from '@mechane/rule-shapes';
import { Option, Record } from 'effect';
import { posix } from 'node:path';
import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import type { GeneratedFile, WorkspaceMember } from '../types.ts';
import { configurationText } from './configuration-text.ts';
import type { ConfigurationNote } from './types.ts';

/** The kinds whose member holds programs, each of whose `main.ts` files below `src` is an entry. */
const PROGRAM_KINDS: ReadonlySet<PackageKind> = new Set([
  PackageKind.Program,
  PackageKind.LibraryProgram,
  PackageKind.Scenarios,
]);

/** A member's own source folder, which holds a program's `main.ts`. */
const SOURCE_FOLDER = 'src';

/** A member's folder of generators, whose every `main.ts` is an entry. */
const SCRIPTS_FOLDER = 'scripts';

/** Each program's `main.ts` below a source root, a production file. */
const PROGRAM_ENTRIES = '**/main.ts!';

/** Each generator's `main.ts`, one folder below the generators' root, a production file. */
const GENERATOR_ENTRIES = '*/main.ts!';

/** Every TypeScript file below a source root, each a production file. */
const PROJECT_FILES = '**/*.ts!';

/** A member's entries and project files, as knip's workspace takes them. */
type MemberWorkspace = Readonly<Record<string, ReadonlyArray<string>>>;

type KnipConfigurationInput = { readonly members: ReadonlyArray<WorkspaceMember> };

type MemberWorkspaceInput = { readonly member: WorkspaceMember };

/**
 * `knip.jsonc`: knip's settings and one workspace for each member but the root, which holds no source. Each takes its
 * entries from its kind and its project from its source roots, all of them production files.
 */
export function knipConfiguration({ members }: KnipConfigurationInput): GeneratedFile {
  const { knip, knipNotes, kindNotes } = CONTRACTS['code-export-consumers'].values;
  const packages = members.filter(({ folder }) => folder !== '');

  const workspaceEntry: (member: WorkspaceMember) => readonly [string, MemberWorkspace] = (member) => [
    member.folder,
    memberWorkspace({ member }),
  ];

  const workspaces = Record.fromEntries(packages.map(workspaceEntry));
  const notesByKind: ReadonlyMap<string, ReadonlyArray<string>> = new Map(Record.toEntries(kindNotes));

  const kindNote: (member: WorkspaceMember) => ReadonlyArray<ConfigurationNote> = ({ folder, entry }) =>
    Option.toArray(Option.fromNullishOr(notesByKind.get(entry.kind))).map((lines) => ({
      path: ['workspaces', folder],
      lines,
    }));

  const notes = [...knipNotes, ...packages.flatMap(kindNote)];
  const value = { $schema: './node_modules/knip/schema-jsonc.json', ...knip, workspaces };

  return { path: ConfigurationPath.Knip, text: configurationText({ value, notes, expanded: [], syntax: Syntax.Json }) };
}

/** A member's workspace: each program's `main.ts` and each generator's, and every file of its roots. */
function memberWorkspace({ member }: MemberWorkspaceInput): MemberWorkspace {
  const roots = member.roots.map((root) => posix.relative(member.folder, root));

  const isProgramSource: (root: string) => boolean = (root) =>
    root === SOURCE_FOLDER && PROGRAM_KINDS.has(member.entry.kind);

  const mains = roots.filter(isProgramSource).map((root) => posix.join(root, PROGRAM_ENTRIES));
  const generators = roots.filter((root) => root === SCRIPTS_FOLDER).map((root) => posix.join(root, GENERATOR_ENTRIES));
  const entry = [...mains, ...generators];
  const project = roots.map((root) => posix.join(root, PROJECT_FILES));

  if (entry.length === 0) {
    return { project };
  }

  return { entry, project };
}

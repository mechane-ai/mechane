import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import { parsedSources } from '@mechane/checks-kernel';
import { exportTable } from '@mechane/modules';
import { entryFiles } from '@mechane/normalizers';
import { Array, Effect, Option } from 'effect';
import { MoveRefused } from '../errors.ts';
import { entrySources } from '../package-manifests/entry-sources.ts';
import type { RewrittenSource, StepLayout } from '../packages.types.ts';
import { rewrittenSource } from './rewritten-source.ts';

/** A step's layout and the workspace's members before it. */
type RewrittenTreeInput = { readonly layout: StepLayout; readonly members: ReadonlyArray<Member> };

/** The workspace's members, and each entry their manifests export by the folder of the member that holds it. */
type MemberEntriesInput = { readonly members: ReadonlyArray<Member>; readonly entries: ReadonlyMap<string, string> };

/**
 * Every TypeScript file of the members' source roots as the step leaves it, and each entry another member takes a new
 * name from. An import that a literal path would make across members, and a name taken from the root, which exports
 * nothing, are refused.
 */
export const rewrittenTree = Effect.fn('rewrittenTree')(function* ({
  layout,
  members,
}: RewrittenTreeInput): Effect.fn.Return<ReadonlyArray<RewrittenSource>, InputUnreadable | MoveRefused> {
  const sources = yield* parsedSources({ members });
  const entries = memberEntries({ members, entries: yield* entryFiles({ members }) });
  const context = { layout, table: exportTable({ sources }), entries };
  const rewritten = sources.map((source) => rewrittenSource({ context, source }));
  const crossing = Array.findFirst(rewritten, ({ crossings }) => crossings.length > 0);

  if (Option.isSome(crossing)) {
    const { source, crossings } = crossing.value;

    return yield* new MoveRefused({
      path: source.from,
      reason: `import ${crossings.join(', ')} by name, as no path crosses members`,
    });
  }

  const files = rewritten.map(({ source }) => source);
  const requirements = files.flatMap((source) => source.requirements);
  const rooted = Array.findFirst(requirements, ({ member }) => member === layout.root);

  if (Option.isSome(rooted)) {
    return yield* new MoveRefused({
      path: rooted.value.path,
      reason: 'move it into a member, as the root exports nothing',
    });
  }

  const added = entrySources({ requirements, sources: files });
  const replaced: ReadonlySet<string> = new Set(added.map(({ path }) => path));

  /** Whether no entry the step writes replaces the file. */
  const isKept: (source: RewrittenSource) => boolean = ({ path }) => !replaced.has(path);

  return [...files.filter(isKept), ...added];
});

/** Each member's entry before the step, by the member's package name. */
function memberEntries({ members, entries }: MemberEntriesInput): ReadonlyMap<string, string> {
  const names = new Map(members.map(({ folder, name }) => [folder, name]));

  /** The entry by the name of the member whose folder holds it, none for an entry of no member. */
  const namedEntries: (entry: readonly [string, string]) => ReadonlyArray<readonly [string, string]> = ([
    entry,
    folder,
  ]) => Option.toArray(Option.fromNullishOr(names.get(folder))).map((name) => [name, entry] as const);

  return new Map([...entries].flatMap(namedEntries));
}

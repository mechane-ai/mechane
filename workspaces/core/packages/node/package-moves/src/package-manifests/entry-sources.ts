import { parsedText } from '@mechane/checks-kernel';
import { editedText, exportTable, statementEdits } from '@mechane/modules';
import { Array, Option } from 'effect';
import { posix } from 'node:path';
import type { PlacedMember, Requirement, RewrittenSource } from '../packages.types.ts';
import { ENTRY_PATH } from './constants.ts';
import { reexports } from './reexports.ts';

/** The names files take from other members' entries after the step, and every file after it. */
type EntrySourcesInput = {
  readonly requirements: ReadonlyArray<Requirement>;
  readonly sources: ReadonlyArray<RewrittenSource>;
};

/** A member another member takes names from, the names, and every file after the step. */
type EntrySourceInput = {
  readonly member: PlacedMember;
  readonly requirements: ReadonlyArray<Requirement>;
  readonly sources: ReadonlyArray<RewrittenSource>;
};

/**
 * The entry of each member that another member's file takes a name from after the step. It gains a re-export of each
 * name it lacks from the file that declares it, type-only when every file takes only its type. A new entry starts
 * empty.
 */
export function entrySources({ requirements, sources }: EntrySourcesInput): ReadonlyArray<RewrittenSource> {
  return [...Map.groupBy(requirements, ({ member }) => member)].map(([member, group]) =>
    entrySource({ member, requirements: group, sources }),
  );
}

/** One member's entry after the step, with a re-export of each name another member takes that it lacks. */
function entrySource({ member, requirements, sources }: EntrySourceInput): RewrittenSource {
  const path = posix.join(member.folder, ENTRY_PATH);

  const { from, text, isChanged } = Option.getOrElse(
    Array.findFirst(sources, (source) => source.path === path),
    () => ({ from: path, text: '', isChanged: true }),
  );

  const source = parsedText({ path, text });

  const exported: ReadonlySet<string> = new Set(
    Option.match(Option.fromNullishOr(exportTable({ sources: [source] }).get(path)), {
      onNone: () => [],
      onSome: (exports) => exports.keys(),
    }),
  );

  /** Whether the entry lacks the name another member takes. */
  const isMissing: (requirement: Requirement) => boolean = ({ exported: name }) => !exported.has(name);
  const missing = requirements.filter(isMissing);
  const rewrite = { dropped: [], added: reexports({ path, missing }) };

  const edited = editedText({ text, edits: statementEdits({ source, rewrite }) });

  return { from, path, text: edited, isChanged: isChanged || edited !== text, requirements: [] };
}

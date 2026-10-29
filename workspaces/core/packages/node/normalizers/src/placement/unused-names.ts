import { isWithin, StatementKind } from '@mechane/modules';
import type {
  DroppedName,
  FileFacts,
  ModuleName,
  ModuleStatement,
  Need,
  Reference,
  UnitStatement,
} from '@mechane/modules';

/** A file's facts, the statements a round removes from it, and the needs of the units landing in it. */
type UnusedNamesInput = {
  readonly file: FileFacts;
  readonly removed: ReadonlyArray<UnitStatement>;
  readonly needs: ReadonlyArray<Need>;
};

/** The imports of a file that only its removed units used, which no unit landing there needs. */
export function unusedNames({ file, removed, needs }: UnusedNamesInput): ReadonlyArray<DroppedName> {
  const needed: ReadonlySet<string> = new Set(needs.map(({ local }) => local));
  const lost = file.references.filter(({ offset }) => isWithin({ spans: removed, offset }));
  const lostOffsets: ReadonlySet<number> = new Set(lost.map(({ offset }) => offset));
  const lostNames: ReadonlySet<string> = new Set(lost.map(({ name }) => name));

  /** Whether the reference stands outside the removed units. */
  const isKeptReference: (reference: Reference) => boolean = ({ offset }) => !lostOffsets.has(offset);
  const keptNames: ReadonlySet<string> = new Set(file.references.filter(isKeptReference).map(({ name }) => name));

  /** Whether only the removed units read the name, and no landing unit needs it. */
  const isUnused: (name: ModuleName) => boolean = ({ local }) =>
    lostNames.has(local) && !keptNames.has(local) && !needed.has(local);

  /** The names the import binds that the file drops. */
  const droppedNames: (statement: ModuleStatement) => ReadonlyArray<DroppedName> = (statement) =>
    statement.names.filter(isUnused).map(({ local }) => ({ start: statement.start, local }));

  return file.statements.filter(({ kind }) => kind === StatementKind.Import).flatMap(droppedNames);
}

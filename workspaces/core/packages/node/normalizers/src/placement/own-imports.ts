import { isWithin, StatementKind } from '@mechane/modules';
import type { AddedStatement, FileFacts, Move, Reference, UnitStatement } from '@mechane/modules';
import { relativeSpecifier } from '@mechane/program';
import { Option } from 'effect';

/** A file a round changes, the moves that take units out of it, and the spans those units leave. */
type OwnImportsInput = {
  readonly file: FileFacts;
  readonly leaving: ReadonlyArray<Move>;
  readonly removed: ReadonlyArray<UnitStatement>;
};

/**
 * The import of each unit that leaves the file while the file still names it, from where it lands: type-only when every
 * name it keeps stands in a type.
 */
export function ownImports({ file, leaving, removed }: OwnImportsInput): ReadonlyArray<AddedStatement> {
  /** The import of the unit the move takes out, or none when the file no longer names it. */
  const ownImport: (move: Move) => ReadonlyArray<AddedStatement> = ({ unit, to }) => {
    /** Whether the reference names the unit outside the removed spans. */
    const isKeptUse: (reference: Reference) => boolean = ({ name, offset }) =>
      name === unit.name && !isWithin({ spans: removed, offset });

    const kept = file.references.filter(isKeptUse);

    if (kept.length === 0) {
      return [];
    }

    return [
      {
        kind: StatementKind.Import,
        isTypeOnly: unit.isTypeOnly || kept.every(({ isType }) => isType),
        specifier: relativeSpecifier({ importer: file.source.path, target: to }),
        target: Option.some(to),
        names: [{ imported: unit.name, local: unit.name }],
        anchor: Option.none(),
      },
    ];
  };

  return leaving.flatMap(ownImport);
}

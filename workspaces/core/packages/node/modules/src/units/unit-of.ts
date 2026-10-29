import { isTypeDeclaration } from '../declarations/is-type-declaration.ts';
import { kindRole } from '../declarations/kind-role.ts';
import { lineAt } from '../line-at.ts';
import { isWithin } from '../references/is-within.ts';
import type { ParsedSource, Reference, TopLevelDeclaration, Unit } from '../types.ts';
import { unitStatement } from './unit-statement.ts';

/** A name, the file's top-level declarations of it, the file, its references and its located expressions' offsets. */
type UnitOfInput = {
  readonly name: string;
  readonly entries: ReadonlyArray<TopLevelDeclaration>;
  readonly source: ParsedSource;
  readonly references: ReadonlyArray<Reference>;
  readonly located: ReadonlyArray<number>;
};

/** The unit a movable name moves as: its statements with their comments, the names they use, and its kind's role. */
export function unitOf({ name, entries, source, references, located }: UnitOfInput): Unit {
  const { text } = source;
  const { comments } = source.parsed;
  const statements = entries.map((entry) => unitStatement({ text, comments, entry }));

  /** Whether the reference names another binding from inside the unit's statements. */
  const isUnitReference: (reference: Reference) => boolean = (reference) =>
    reference.name !== name && isWithin({ spans: statements, offset: reference.offset });

  return {
    name,
    path: source.path,
    line: lineAt({ text, offset: Math.min(...statements.map(({ start }) => start)) }),
    statements,
    references: references.filter(isUnitReference),
    isTypeOnly: entries.every(({ declaration }) => isTypeDeclaration({ declaration })),
    isLocated: located.some((offset) => isWithin({ spans: statements, offset })),
    kindRole: kindRole({ entries, text }),
  };
}

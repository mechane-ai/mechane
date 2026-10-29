import { Option } from 'effect';
import type { AddedStatement, ModuleName } from '../types.ts';
import { statementKey } from './statement-key.ts';

/** The added statements a statement of the file absorbs, and the start of that statement by each one's key. */
type BroughtNamesInput = {
  readonly absorbed: ReadonlyArray<AddedStatement>;
  readonly absorbing: ReadonlyMap<string, number>;
};

/** An absorbed statement, and the start of the statement that absorbs it. */
type BroughtStatement = { readonly start: number; readonly added: AddedStatement };

/** The names each absorbed statement brings, by the start of the statement that absorbs it. */
export function broughtNames({
  absorbed,
  absorbing,
}: BroughtNamesInput): ReadonlyMap<number, ReadonlyArray<ModuleName>> {
  /** An absorbed statement under the start of the statement that absorbs it. */
  const absorbedAt: (added: AddedStatement) => ReadonlyArray<BroughtStatement> = (added) =>
    Option.toArray(Option.fromNullishOr(absorbing.get(statementKey(added)))).map((start) => ({ start, added }));

  /** The names a statement absorbs, under its start. */
  const startNames: (
    group: readonly [number, ReadonlyArray<BroughtStatement>],
  ) => readonly [number, ReadonlyArray<ModuleName>] = ([start, group]) => [
    start,
    group.flatMap(({ added }) => added.names),
  ];

  const brought = absorbed.flatMap(absorbedAt);

  return new Map([...Map.groupBy(brought, ({ start }) => start)].map(startNames));
}

import { Array, Option } from 'effect';
import type { AddedStatement, ModuleStatement } from '../types.ts';

/** The added statements no statement absorbs, and the file's statements, the last of which they land after. */
type AnchoredStatementsInput = {
  readonly placed: ReadonlyArray<AddedStatement>;
  readonly statements: ReadonlyArray<ModuleStatement>;
};

/** An added statement, and the start of the statement it lands after. */
type LandingStatement = { readonly start: number; readonly added: AddedStatement };

/** The statements no statement absorbs, by the start of the statement each lands after: its anchor, or the last. */
export function anchoredStatements({
  placed,
  statements,
}: AnchoredStatementsInput): ReadonlyMap<number, ReadonlyArray<AddedStatement>> {
  const last = Option.map(Array.last(statements), ({ start }) => start);

  /** An added statement under the start of the statement it lands after. */
  const landingAt: (added: AddedStatement) => ReadonlyArray<LandingStatement> = (added) =>
    Option.toArray(Option.orElse(added.anchor, () => last)).map((start) => ({ start, added }));

  /** The statements that land after a statement, under its start. */
  const startStatements: (
    group: readonly [number, ReadonlyArray<LandingStatement>],
  ) => readonly [number, ReadonlyArray<AddedStatement>] = ([start, group]) => [start, group.map(({ added }) => added)];

  const landing = placed.flatMap(landingAt);

  return new Map([...Map.groupBy(landing, ({ start }) => start)].map(startStatements));
}

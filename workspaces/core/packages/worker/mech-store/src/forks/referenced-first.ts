import type { TableReference } from './types.ts';

/** The tables not placed yet, and those placed so each follows every other copied table its foreign keys name. */
type TableOrder = { readonly unplaced: ReadonlyArray<string>; readonly placed: ReadonlyArray<string> };

/** The tables to order, and the foreign keys between them. */
type PlaceTablesInput = { readonly order: TableOrder; readonly references: ReadonlyArray<TableReference> };

/** The tables a copy moves, and the foreign keys between them. */
type ReferencedFirstInput = {
  readonly tables: ReadonlyArray<string>;
  readonly references: ReadonlyArray<TableReference>;
};

/** Orders the tables so each follows every other copied table its foreign keys name; the schema has no key cycle. */
export function referencedFirst({ tables, references }: ReferencedFirstInput): ReadonlyArray<string> {
  let order: TableOrder = { unplaced: tables, placed: [] };

  while (order.unplaced.length > 0) {
    order = placeTables({ order, references });
  }

  return order.placed;
}

/** Places every unplaced table whose foreign keys name no other unplaced table, after the tables placed before. */
function placeTables({ order, references }: PlaceTablesInput): TableOrder {
  const { unplaced, placed } = order;

  const isWaiting: (reference: TableReference) => boolean = ({ name, target }) =>
    target !== name && unplaced.includes(target);

  const waiting: ReadonlySet<string> = new Set(references.filter(isWaiting).map(({ name }) => name));
  const isPlaceable: (table: string) => boolean = (table) => !waiting.has(table);
  const placeable = unplaced.filter(isPlaceable);
  const isUnplaced: (table: string) => boolean = (table) => !placeable.includes(table);

  return { unplaced: unplaced.filter(isUnplaced), placed: [...placed, ...placeable] };
}

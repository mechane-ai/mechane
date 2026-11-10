export type Page<Row> = { readonly items: ReadonlyArray<Row>; readonly hasMore: boolean };
type PageInput<Row> = { readonly rows: ReadonlyArray<Row>; readonly maxRows: number };

export function pageFromRows<Row>({ rows, maxRows }: PageInput<Row>): Page<Row> {
  return { items: rows.slice(0, maxRows), hasMore: rows.length > maxRows };
}

import type { AreaCell } from './treemap-layout.ts';

/** One node of a hierarchy to place. Its value is the application's own total for the node and its descendants. */
export type PartitionInput = { readonly id: string; readonly parentId: string | null; readonly value: number };

/** A placed node: its rectangle and how deep it sits below the root, which is depth 0. */
export type PartitionCell = AreaCell & { readonly depth: number };

type Span = { readonly node: PartitionInput; readonly x0: number; readonly x1: number; readonly depth: number };

function sumValues(nodes: ReadonlyArray<PartitionInput>): number {
  return nodes.reduce((total, node) => total + node.value, 0);
}

export type PartitionLayoutInput = {
  /** One root with a null parent, and parents before or after their children in any order. */
  readonly nodes: ReadonlyArray<PartitionInput>;
  readonly width: number;
  readonly height: number;
};

/**
 * An icicle partition, as a pure function with no DOM access: the root spans the full width of the top row. Each child
 * takes a share of its parent's width in proportion to its value, in supplied order, one row further down. A parent
 * whose value exceeds its children's sum keeps the rest of its width empty, so nothing is inferred.
 */
export function partitionLayout({ nodes, width, height }: PartitionLayoutInput): ReadonlyArray<PartitionCell> {
  function childSpans(span: Span): ReadonlyArray<Span> {
    const children = nodes.filter((candidate) => candidate.parentId === span.node.id);
    const scale = span.node.value === 0 ? 0 : (span.x1 - span.x0) / span.node.value;

    return children.map((child, index) => {
      const start = span.x0 + sumValues(children.slice(0, index)) * scale;

      return { node: child, x0: start, x1: start + child.value * scale, depth: span.depth + 1 };
    });
  }

  const roots: ReadonlyArray<Span> = nodes
    .filter((node) => node.parentId === null)
    .map((node) => ({ node, x0: 0, x1: width, depth: 0 }));

  /**
   * Row by row: each row holds the children of the row above.
   *
   * @yields The spans of each row, top row first.
   */
  function* rows(): Generator<ReadonlyArray<Span>> {
    const row = { spans: roots };

    while (row.spans.length > 0) {
      yield row.spans;
      row.spans = row.spans.flatMap(childSpans);
    }
  }

  const spans = Array.from(rows()).flat();
  const rowHeight = height / (Math.max(0, ...spans.map((span) => span.depth)) + 1);

  return spans.map(({ node, x0, x1, depth }) => ({
    id: node.id,
    depth,
    x0,
    x1,
    y0: depth * rowHeight,
    y1: (depth + 1) * rowHeight,
  }));
}

/** The cell under a position, such as the pointer, or undefined over empty space. */
export function cellAt(cells: ReadonlyArray<AreaCell>, x: number, y: number): AreaCell | undefined {
  return cells.find((cell) => {
    const isInColumn = x >= cell.x0 && x < cell.x1;
    const isInRow = y >= cell.y0 && y < cell.y1;

    return isInColumn && isInRow;
  });
}

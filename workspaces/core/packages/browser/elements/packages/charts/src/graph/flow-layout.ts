import type { ChartTone } from '../../../foundations/src/chart-tones.ts';

/** A stage that amounts flow into or out of. The column follows from the links: sources first, then each next step. */
export type FlowNode = {
  readonly id: string;
  readonly label: string;
  /** Absent takes the tone a `ToneScope` gives its id, or the next automatic series tone in node order. */
  readonly tone?: ChartTone | undefined;
};

/**
 * A supplied amount moving from one node to another. A null value records a known relationship whose amount is
 * unavailable; it draws a dashed thread and adds nothing to either node.
 */
export type FlowLink = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly value: number | null;
  /** Absent uses the target node's tone, so each ribbon reads as part of where it arrives. */
  readonly tone?: ChartTone | undefined;
};

export type PlacedFlowNode = {
  readonly node: FlowNode;
  readonly tone: ChartTone;
  readonly column: number;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly inflow: number;
  readonly outflow: number;
  readonly hasUnavailable: boolean;
};

export type PlacedFlowLink = {
  readonly link: FlowLink;
  readonly tone: ChartTone;
  readonly source: PlacedFlowNode;
  readonly target: PlacedFlowNode;
  readonly sourceY: number;
  readonly targetY: number;
  readonly width: number;
};

export type FlowLayout = {
  readonly nodes: ReadonlyArray<PlacedFlowNode>;
  readonly links: ReadonlyArray<PlacedFlowLink>;
  readonly columnCount: number;
};

type LayoutInput = {
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  /** Each node's resolved tone, from its own, its scope's or its place in `nodes`. */
  readonly toneOf: (node: FlowNode, index: number) => ChartTone;
};

export const FLOW_NODE_WIDTH_PX = 12;
const NODE_GAP_PX = 16;
const NODE_MIN_HEIGHT_PX = 2;
const HALF = 0.5;

type ColumnInput = Pick<LayoutInput, 'nodes' | 'links'>;

/** One round of longest-path relaxation: each node sits one column after its furthest source. */
function relaxColumns({
  nodes,
  links,
  columns,
}: ColumnInput & { readonly columns: ReadonlyMap<string, number> }): ReadonlyMap<string, number> {
  return new Map(
    nodes.map((node) => {
      const reached = links
        .filter((link) => link.targetId === node.id)
        .map((link) => (columns.get(link.sourceId) ?? 0) + 1);

      return [node.id, Math.max(0, ...reached)];
    }),
  );
}

/**
 * Each node's column: zero for sources, then the length of the longest path that reaches it. Undefined when the links
 * form a cycle, because a path through a cycle never stops growing.
 */
export function flowColumns({ nodes, links }: ColumnInput): ReadonlyMap<string, number> | undefined {
  let columns: ReadonlyMap<string, number> = new Map(nodes.map((node) => [node.id, 0]));

  for (const _ of nodes) {
    columns = relaxColumns({ nodes, links, columns });
  }

  const settled = relaxColumns({ nodes, links, columns });
  const isSettled = nodes.every((node) => settled.get(node.id) === columns.get(node.id));

  return isSettled ? columns : undefined;
}

function sum(values: ReadonlyArray<number>): number {
  return values.reduce((total, value) => total + value, 0);
}

function amount(link: FlowLink): number {
  return link.value ?? 0;
}

/** The offset of each item when stacked in order, starting at zero. */
function offsets(sizes: ReadonlyArray<number>): ReadonlyArray<number> {
  return sizes.map((_, index) => sum(sizes.slice(0, index)));
}

/**
 * Lays nodes out in columns by longest path and keeps their supplied order within each column. Nodes and ribbons share
 * one scale, so every amount keeps the same length per unit.
 */
export function layoutFlow({ nodes, links, left, right, top, bottom, toneOf }: LayoutInput): FlowLayout {
  const columnOf = flowColumns({ nodes, links }) ?? new Map<string, number>();
  const columnCount = Math.max(1, ...[...columnOf.values()].map((column) => column + 1));

  const columns = Array.from({ length: columnCount }, (_, column) =>
    nodes.filter((node) => columnOf.get(node.id) === column),
  );

  const totals = nodes.map((node) => {
    const incoming = links.filter((link) => link.targetId === node.id);
    const outgoing = links.filter((link) => link.sourceId === node.id);
    const hasUnavailable = [...incoming, ...outgoing].some((link) => link.value === null);

    return { id: node.id, inflow: sum(incoming.map(amount)), outflow: sum(outgoing.map(amount)), hasUnavailable };
  });

  const totalOf = new Map(totals.map((total) => [total.id, total]));

  function size(node: FlowNode): number {
    const total = totalOf.get(node.id);

    return Math.max(total?.inflow ?? 0, total?.outflow ?? 0);
  }

  const available = bottom - top;

  const scale = Math.min(
    ...columns.map((column) => {
      const columnTotal = sum(column.map(size));
      const space = available - Math.max(0, column.length - 1) * NODE_GAP_PX - column.length * NODE_MIN_HEIGHT_PX;

      return columnTotal === 0 ? Number.POSITIVE_INFINITY : Math.max(0, space) / columnTotal;
    }),
  );

  const unit = Number.isFinite(scale) ? scale : 0;
  const step = columnCount === 1 ? 0 : (right - left - FLOW_NODE_WIDTH_PX) / (columnCount - 1);

  const placedNodes = columns.flatMap((column, columnIndex) => {
    const heights = column.map((node) => Math.max(NODE_MIN_HEIGHT_PX, size(node) * unit));
    const blockHeight = sum(heights) + Math.max(0, column.length - 1) * NODE_GAP_PX;
    const start = top + (available - blockHeight) * HALF;
    const positions = offsets(heights.map((height) => height + NODE_GAP_PX));

    return column.map((node, index) => {
      const total = totalOf.get(node.id);

      return {
        node,
        tone: toneOf(node, nodes.indexOf(node)),
        column: columnIndex,
        x: left + columnIndex * step,
        y: start + (positions[index] ?? 0),
        height: heights[index] ?? NODE_MIN_HEIGHT_PX,
        inflow: total?.inflow ?? 0,
        outflow: total?.outflow ?? 0,
        hasUnavailable: total?.hasUnavailable ?? false,
      };
    });
  });

  const placedOf = new Map(placedNodes.map((placed) => [placed.node.id, placed]));

  function center(id: string): number {
    const placed = placedOf.get(id);

    return placed === undefined ? 0 : placed.y + placed.height * HALF;
  }

  function stackedOffsets(
    attached: ReadonlyArray<FlowLink>,
    end: (link: FlowLink) => string,
  ): ReadonlyMap<string, number> {
    const ordered = attached.toSorted((first, second) => center(end(first)) - center(end(second)));
    const starts = offsets(ordered.map((link) => amount(link) * unit));

    return new Map(ordered.map((link, index) => [link.id, starts[index] ?? 0]));
  }

  const leaving = new Map(
    placedNodes.map((placed) => [
      placed.node.id,
      stackedOffsets(
        links.filter((link) => link.sourceId === placed.node.id),
        (link) => link.targetId,
      ),
    ]),
  );

  const arriving = new Map(
    placedNodes.map((placed) => [
      placed.node.id,
      stackedOffsets(
        links.filter((link) => link.targetId === placed.node.id),
        (link) => link.sourceId,
      ),
    ]),
  );

  const placedLinks = links.flatMap((link) => {
    const source = placedOf.get(link.sourceId);
    const target = placedOf.get(link.targetId);

    if (source === undefined || target === undefined) {
      return [];
    }

    const sourceOffset = leaving.get(source.node.id)?.get(link.id) ?? 0;
    const targetOffset = arriving.get(target.node.id)?.get(link.id) ?? 0;

    return [
      {
        link,
        tone: link.tone ?? target.tone,
        source,
        target,
        sourceY: source.y + sourceOffset,
        targetY: target.y + targetOffset,
        width: amount(link) * unit,
      },
    ];
  });

  return { nodes: placedNodes, links: placedLinks, columnCount };
}

/** A ribbon from the source's right edge to the target's left edge, with horizontal tangents at both ends. */
export function ribbonPath(placed: PlacedFlowLink): string {
  const startX = placed.source.x + FLOW_NODE_WIDTH_PX;
  const endX = placed.target.x;
  const middleX = (startX + endX) * HALF;
  const { sourceY, targetY, width } = placed;

  return [
    `M${startX},${sourceY}`,
    `C${middleX},${sourceY} ${middleX},${targetY} ${endX},${targetY}`,
    `L${endX},${targetY + width}`,
    `C${middleX},${targetY + width} ${middleX},${sourceY + width} ${startX},${sourceY + width}`,
    'Z',
  ].join(' ');
}

/** The center line of a ribbon, used for unavailable and zero amounts that have no width. */
export function threadPath(placed: PlacedFlowLink): string {
  const startX = placed.source.x + FLOW_NODE_WIDTH_PX;
  const endX = placed.target.x;
  const middleX = (startX + endX) * HALF;
  const sourceY = placed.sourceY + placed.width * HALF;
  const targetY = placed.targetY + placed.width * HALF;

  return `M${startX},${sourceY} C${middleX},${sourceY} ${middleX},${targetY} ${endX},${targetY}`;
}

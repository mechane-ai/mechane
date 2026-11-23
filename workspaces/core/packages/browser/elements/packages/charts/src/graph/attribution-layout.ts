import { linkPath } from '../plot/path.ts';

/** Which way the layers advance: from the bottom up, as the field draws it, or from left to right. */
export type AttributionDirection = 'up' | 'right';

export type AttributionLayoutInput = {
  readonly layers: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  /** Nodes in the order the application wants them within each layer. */
  readonly nodes: ReadonlyArray<{ readonly id: string; readonly layerId: string; readonly label: string }>;
  readonly edges: ReadonlyArray<{
    readonly id: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly weight: number;
  }>;
  readonly direction: AttributionDirection;
  /** The width the frame gives the plot. The layout grows past it, and the plot scrolls, when nodes need more room. */
  readonly width: number;
};

export type PlacedAttributionNode = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly layerIndex: number;
};

/** A layer's band and where its name sits. */
export type PlacedAttributionLayer = {
  readonly id: string;
  readonly label: string;
  readonly labelX: number;
  readonly labelY: number;
  /** The band's edges across the advance axis, for a pale stripe behind alternate layers. */
  readonly start: number;
  readonly end: number;
};

export type PlacedAttributionEdge = { readonly id: string; readonly d: string; readonly width: number };

export type AttributionLayout = {
  readonly width: number;
  readonly height: number;
  readonly layers: ReadonlyArray<PlacedAttributionLayer>;
  readonly nodes: ReadonlyMap<string, PlacedAttributionNode>;
  readonly edges: ReadonlyArray<PlacedAttributionEdge>;
  /**
   * The room each node's label has, in pixels: beside its node, toward the next node in its layer, when layers rise;
   * above it, across its column, when they run right.
   */
  readonly labelWidth: number;
  /** The largest absolute weight, which draws the widest edge. */
  readonly weightMax: number;
};

/** The geometry every attribution layout shares, in CSS pixels. */
export const attributionGeometry = {
  nodeRadius: 6,
  edgeWidthMin: 0.75,
  edgeWidthMax: 5,
  padding: 16,
  band: 76,
  spacingMin: 64,
  /** The widest a node's slot grows to give its label room, before the label is cut. */
  spacingMax: 200,
  gutterMax: 140,
  gutterGap: 16,
  characterWidth: 7,
  columnMin: 120,
  rowSpacing: 40,
  header: 36,
  labelGap: 6,
  labelGapAcross: 8,
} as const;

/** The stroke width of an edge: its absolute weight as a share of the largest one. */
export function edgeWidth({ weight, weightMax }: { readonly weight: number; readonly weightMax: number }): number {
  const { edgeWidthMin, edgeWidthMax } = attributionGeometry;
  const share = weightMax > 0 ? Math.abs(weight) / weightMax : 0;

  return edgeWidthMin + (edgeWidthMax - edgeWidthMin) * share;
}

const HALF = 0.5;
const SIDES = 2;

type Spread = {
  readonly count: number;
  readonly size: number;
  readonly start: number;
  readonly spacing: number;
  /** Where a node sits within its slot, from the slot's start. */
  readonly inset: number;
};

/** Where the nth of `count` nodes sits, centered in a run sized for the busiest layer. */
function spreadPosition(spread: Spread, index: number): number {
  const offset = (spread.size - spread.count) * spread.spacing * HALF;

  return spread.start + offset + index * spread.spacing + spread.inset;
}

/**
 * Places an attribution graph: each layer is a band in supplied order, and each node sits in its layer in supplied
 * order, centered on the busiest layer. Nothing is reordered or simulated. Edges are curves from source to target whose
 * width follows the absolute weight.
 */
export function attributionLayout({
  layers,
  nodes,
  edges,
  direction,
  width,
}: AttributionLayoutInput): AttributionLayout {
  const geometry = attributionGeometry;
  const members = layers.map((layer) => nodes.filter((node) => node.layerId === layer.id));
  const busiest = Math.max(1, ...members.map((layerNodes) => layerNodes.length));
  const isUp = direction === 'up';
  const longest = Math.max(0, ...layers.map((layer) => layer.label.length));
  const gutter = isUp ? Math.min(geometry.gutterMax, longest * geometry.characterWidth + geometry.gutterGap) : 0;
  const across = width - gutter - geometry.padding * SIDES;
  const longestNode = Math.max(0, ...nodes.map((node) => node.label.length));
  const labelled = geometry.nodeRadius + geometry.labelGap * SIDES + longestNode * geometry.characterWidth;

  const spacing = isUp
    ? Math.max(geometry.spacingMin, Math.min(geometry.spacingMax, labelled), across / busiest)
    : geometry.rowSpacing;

  const inset = isUp ? geometry.nodeRadius + geometry.labelGap : spacing * HALF;
  const column = Math.max(geometry.columnMin, (width - geometry.padding * SIDES) / Math.max(1, layers.length));
  const runStart = isUp ? gutter + geometry.padding : geometry.header + geometry.padding;
  const runSize = busiest * spacing;

  const canvasWidth = isUp ? runStart + runSize + geometry.padding : layers.length * column + geometry.padding * SIDES;

  const canvasHeight = isUp
    ? layers.length * geometry.band + geometry.padding * SIDES
    : runStart + runSize + geometry.padding;

  function advance(index: number): number {
    return isUp
      ? geometry.padding + (layers.length - 1 - index + HALF) * geometry.band
      : geometry.padding + (index + HALF) * column;
  }

  const placed = members.flatMap((layerNodes, index) =>
    layerNodes.map((node, order) => {
      const along = advance(index);

      const spread = spreadPosition(
        { count: layerNodes.length, size: busiest, start: runStart, spacing, inset },
        order,
      );

      return { id: node.id, layerIndex: index, x: isUp ? spread : along, y: isUp ? along : spread };
    }),
  );

  const placedNodes = new Map(placed.map((node) => [node.id, node]));
  const weightMax = Math.max(0, ...edges.map((edge) => Math.abs(edge.weight)));
  const radius = geometry.nodeRadius;

  const placedEdges = edges.flatMap((edge) => {
    const source = placedNodes.get(edge.sourceId);
    const target = placedNodes.get(edge.targetId);

    if (source === undefined || target === undefined) {
      return [];
    }

    const path = isUp
      ? linkPath({ x1: source.x, y1: source.y - radius, x2: target.x, y2: target.y + radius, axis: 'y' })
      : linkPath({ x1: source.x + radius, y1: source.y, x2: target.x - radius, y2: target.y, axis: 'x' });

    return [{ id: edge.id, d: path, width: edgeWidth({ weight: edge.weight, weightMax }) }];
  });

  const placedLayers = layers.map((layer, index) => {
    const along = advance(index);
    const half = (isUp ? geometry.band : column) * HALF;

    return {
      id: layer.id,
      label: layer.label,
      labelX: isUp ? geometry.padding : along,
      labelY: isUp ? along : geometry.padding + geometry.labelGapAcross,
      start: along - half,
      end: along + half,
    };
  });

  return {
    width: canvasWidth,
    height: canvasHeight,
    layers: placedLayers,
    nodes: placedNodes,
    edges: placedEdges,
    labelWidth: isUp
      ? spacing - geometry.nodeRadius - geometry.labelGap * SIDES
      : column - geometry.labelGapAcross * SIDES,
    weightMax,
  };
}

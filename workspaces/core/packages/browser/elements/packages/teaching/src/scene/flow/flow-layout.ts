import type { NumericDomain } from '../../../../charts/src/index.ts';
import type { LessonGraph } from '../../lesson/define-lesson.ts';
import type { ScenePosition } from '../scene-geometry.ts';

/** Which way the layers of a flow advance: from left to right, or from top to bottom. */
export type FlowDirection = 'across' | 'down';

/** One value of a flow with its place: the layer it sits in and its row inside that layer. */
export type FlowSlot = {
  readonly name: string;
  readonly kind: 'param' | 'derived';
  readonly label: string;
  readonly layer: number;
  readonly row: number;
};

/** A lesson graph arranged in layers, ready to be placed in a box. */
export type FlowPlan = {
  readonly slots: ReadonlyArray<FlowSlot>;
  readonly edges: LessonGraph['edges'];
  /** How many layers the values fill. */
  readonly layers: number;
  /** How many values the busiest layer holds. */
  readonly rows: number;
};

const HALF = 0.5;

/** The names in `names` and every value they read, directly or through others. */
function ancestry(graph: LessonGraph, names: ReadonlyArray<string>): ReadonlySet<string> {
  const walk: { reached: ReadonlySet<string>; pending: ReadonlyArray<string> } = { reached: new Set(), pending: names };

  while (walk.pending.length > 0) {
    const [name = '', ...rest] = walk.pending;
    const isUnseen = !walk.reached.has(name);

    walk.reached = isUnseen ? new Set([...walk.reached, name]) : walk.reached;

    walk.pending = isUnseen
      ? [...rest, ...graph.edges.filter((edge) => edge.to === name).map((edge) => edge.from)]
      : rest;
  }

  return walk.reached;
}

/** The middle of some values: the median, which keeps one far input from pulling a value out of line. */
function middle(values: ReadonlyArray<number>): number {
  const sorted = values.toSorted((first, second) => first - second);
  const low = sorted[Math.floor((sorted.length - 1) * HALF)] ?? 0;
  const high = sorted[Math.ceil((sorted.length - 1) * HALF)] ?? low;

  return (low + high) * HALF;
}

/** The first name the graph does not hold, or undefined when it holds them all. */
export function unknownFlowName(graph: LessonGraph, names: ReadonlyArray<string>): string | undefined {
  const known = new Set(graph.nodes.map((node) => node.name));

  return names.find((name) => !known.has(name));
}

/** A layer's values in reading order: by where the values they read sit, then as the lesson declares them. */
function ordered({
  members,
  inputs,
  fractions,
}: {
  readonly members: ReadonlyArray<LessonGraph['nodes'][number]>;
  readonly inputs: (name: string) => ReadonlyArray<string>;
  readonly fractions: ReadonlyMap<string, number>;
}): ReadonlyArray<string> {
  const keyed = members.map((member, index) => {
    const placed = inputs(member.name).flatMap((name) => fractions.get(name) ?? []);
    const center = placed.length === 0 ? Number.POSITIVE_INFINITY : middle(placed);

    return { name: member.name, index, key: center };
  });

  return keyed
    .toSorted((first, second) => {
      const apart = first.key - second.key;

      return apart === 0 || Number.isNaN(apart) ? first.index - second.index : apart;
    })
    .map((item) => item.name);
}

/**
 * Arranges a lesson's derivation in layers. Each derived value sits one layer after the last value it reads, and each
 * param one layer before the first value that reads it. Inside a layer, values follow the values they read.
 */
export function flowPlan(graph: LessonGraph, names?: ReadonlyArray<string>): FlowPlan {
  const kept = names === undefined ? undefined : ancestry(graph, names);
  const nodes = graph.nodes.filter((node) => kept === undefined || kept.has(node.name));
  const included = new Set(nodes.map((node) => node.name));
  const edges = graph.edges.filter((edge) => included.has(edge.from) && included.has(edge.to));
  const placing: { depth: ReadonlyMap<string, number>; unplaced: typeof nodes } = { depth: new Map(), unplaced: nodes };

  function inputs(name: string): ReadonlyArray<string> {
    return edges.filter((edge) => edge.to === name).map((edge) => edge.from);
  }

  while (placing.unplaced.length > 0) {
    const [node, ...rest] = placing.unplaced;
    const known = placing.depth;
    const reads = node === undefined ? [] : inputs(node.name).map((name) => known.get(name) ?? 0);

    const placed =
      node === undefined ? [] : [[node.name, node.kind === 'param' ? 0 : 1 + Math.max(0, ...reads)] as const];

    placing.depth = new Map([...known, ...placed]);

    placing.unplaced = rest;
  }

  const { depth } = placing;

  const layerOf = new Map(
    nodes.map((node) => {
      const readers = edges.filter((edge) => edge.from === node.name).map((edge) => depth.get(edge.to) ?? 1);
      const derivedLayer = depth.get(node.name) ?? 0;
      const paramLayer = readers.length === 0 ? 0 : Math.max(0, Math.min(...readers) - 1);

      return [node.name, node.kind === 'param' ? paramLayer : derivedLayer] as const;
    }),
  );

  const layers = 1 + Math.max(0, ...layerOf.values());

  const laid: { fractions: ReadonlyMap<string, number>; rows: ReadonlyMap<string, number> } = {
    fractions: new Map(),
    rows: new Map(),
  };

  const pendingLayers = Array.from({ length: layers }, (_, index) => index);

  while (pendingLayers.length > 0) {
    const layer = pendingLayers.shift();
    const members = nodes.filter((node) => layerOf.get(node.name) === layer);
    const order = ordered({ members, inputs, fractions: laid.fractions });

    laid.rows = new Map([...laid.rows, ...order.map((name, row) => [name, row] as const)]);

    laid.fractions = new Map([
      ...laid.fractions,
      ...order.map((name, row) => [name, (row + HALF) / order.length] as const),
    ]);
  }

  const slots = nodes.map((node) => ({
    ...node,
    layer: layerOf.get(node.name) ?? 0,
    row: laid.rows.get(node.name) ?? 0,
  }));

  return {
    slots,
    edges,
    layers,
    rows: Math.max(
      1,
      ...Array.from({ length: layers }, (_, layer) => slots.filter((slot) => slot.layer === layer).length),
    ),
  };
}

/** Where along a run of `count` places the place `index` sits, from 0 to 1, centered among `size` places. */
function spread({
  index,
  count,
  size,
}: {
  readonly index: number;
  readonly count: number;
  readonly size: number;
}): number {
  return size <= 1 ? HALF : (index + (size - count) * HALF) / (size - 1);
}

/** The center of each value of a plan inside a data box: layers across or down the box, rows along the other axis. */
export function flowPositions({
  plan,
  box,
  direction,
}: {
  readonly plan: FlowPlan;
  readonly box: { readonly x: NumericDomain; readonly y: NumericDomain };
  readonly direction: FlowDirection;
}): ReadonlyMap<string, ScenePosition> {
  const isAcross = direction === 'across';
  const layerSpan = isAcross ? box.x : box.y;
  const rowSpan = isAcross ? box.y : box.x;

  return new Map(
    plan.slots.map((slot) => {
      const count = plan.slots.filter((other) => other.layer === slot.layer).length;
      const layerFraction = spread({ index: slot.layer, count: plan.layers, size: plan.layers });
      const rowFraction = spread({ index: slot.row, count, size: plan.rows });

      const along = isAcross
        ? layerSpan[0] + layerFraction * (layerSpan[1] - layerSpan[0])
        : layerSpan[1] - layerFraction * (layerSpan[1] - layerSpan[0]);

      const across = isAcross
        ? rowSpan[1] - rowFraction * (rowSpan[1] - rowSpan[0])
        : rowSpan[0] + rowFraction * (rowSpan[1] - rowSpan[0]);

      const position: ScenePosition = isAcross ? [along, across] : [across, along];

      return [slot.name, position] as const;
    }),
  );
}

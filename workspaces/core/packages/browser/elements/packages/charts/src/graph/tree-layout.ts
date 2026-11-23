import { linkPath } from '../plot/path.ts';
import type { LinkShape } from '../plot/path.ts';
import { sum } from '../transforms/values.ts';

/** Which way depth runs: from the root at the left to leaves at the right, or from the root at the top down. */
export type TreeDirection = 'right' | 'down';

/** A node of a flat hierarchy: its parent's id, or null for the root. */
export type TreeLayoutNode = { readonly id: string; readonly parentId: string | null; readonly label: string };

/** A valid hierarchy: its root, each node's children in supplied order, and every node in depth-first order. */
export type TreeStructure = {
  readonly isValid: true;
  readonly root: string;
  readonly children: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Every node, parents before their children, siblings in supplied order, with its distance from the root. */
  readonly order: ReadonlyArray<{
    readonly id: string;
    readonly depth: number;
    /** The ids from the root down to this node. */
    readonly lineage: ReadonlyArray<string>;
  }>;
};

/** Why supplied nodes do not form one tree. */
export type TreeProblem = { readonly isValid: false; readonly message: string };

/** Orders two root paths of sibling positions: a parent before its children, siblings in supplied order. */
function compareKeys(first: ReadonlyArray<number>, second: ReadonlyArray<number>): number {
  const index = first.findIndex((value, position) => value !== second[position]);

  if (index === -1) {
    return first.length - second.length;
  }

  return index >= second.length ? 1 : (first[index] ?? 0) - (second[index] ?? 0);
}

/**
 * Reads a flat list of nodes as one tree, or says why it is not one: a missing or second root, a parent that is not
 * supplied, or a cycle. Nothing is repaired or dropped.
 */
export function treeStructure(nodes: ReadonlyArray<TreeLayoutNode>): TreeStructure | TreeProblem {
  const ids = new Set(nodes.map((node) => node.id));
  const roots = nodes.filter((node) => node.parentId === null);
  const orphan = nodes.find((node) => node.parentId !== null && !ids.has(node.parentId));

  if (orphan !== undefined) {
    return { isValid: false, message: `Node ${orphan.id} names parent ${orphan.parentId}, which is not supplied.` };
  }

  const [root, second] = roots;

  if (root === undefined) {
    return { isValid: false, message: 'The tree has no root. Every node has a parent, so the parents form a cycle.' };
  }

  if (second !== undefined) {
    return { isValid: false, message: `The tree has more than one root: ${root.id} and ${second.id}.` };
  }

  const children = new Map(
    nodes.map((node) => [node.id, nodes.filter((child) => child.parentId === node.id).map((child) => child.id)]),
  );

  const byId = new Map(nodes.map((node) => [node.id, node]));

  /**
   * The path from a node up towards the root. A path longer than the tree has looped.
   *
   * @yields The node, then each ancestor in turn.
   */
  function* ancestry(id: string): Generator<string> {
    const step: { at: string | null; count: number } = { at: id, count: 0 };

    while (step.at !== null && step.count <= nodes.length) {
      yield step.at;
      step.at = byId.get(step.at)?.parentId ?? null;
      step.count += 1;
    }
  }

  /** The path from a node up to the root, or undefined when it loops and never arrives. */
  function chainOf(id: string): ReadonlyArray<string> | undefined {
    const chain = Array.from(ancestry(id));

    return chain.length > nodes.length ? undefined : chain;
  }

  const chains = nodes.map((node) => ({ id: node.id, chain: chainOf(node.id) }));
  const looped = chains.find((entry) => entry.chain === undefined);

  if (looped !== undefined) {
    return { isValid: false, message: `Node ${looped.id} is part of a cycle and never reaches the root.` };
  }

  function siblingIndex(id: string): number {
    const parentId = byId.get(id)?.parentId ?? null;

    return parentId === null ? 0 : (children.get(parentId) ?? []).indexOf(id);
  }

  const keyed = chains.map((entry) => {
    const lineage = (entry.chain ?? []).toReversed();

    return { id: entry.id, lineage, key: lineage.map(siblingIndex) };
  });

  const order = keyed
    .toSorted((left, right) => compareKeys(left.key, right.key))
    .map((entry) => ({ id: entry.id, depth: entry.lineage.length - 1, lineage: entry.lineage }));

  return { isValid: true, root: root.id, children, order };
}

export type PlacedTreeNode = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly isLeaf: boolean;
  /** The room the node's label has, in pixels. */
  readonly labelWidth: number;
  /** Where the links to the node's children start along depth: past its label in a tree that grows right. */
  readonly trunk: number;
};

export type PlacedTreeLink = { readonly id: string; readonly parentId: string; readonly d: string };

export type TreeLayout = {
  readonly width: number;
  readonly height: number;
  readonly nodes: ReadonlyMap<string, PlacedTreeNode>;
  /** One link per node but the root, keyed by the child's id. */
  readonly links: ReadonlyArray<PlacedTreeLink>;
  /** Where leaf labels sit: beside a leaf at the right, below a leaf when they fit across, or turned to read down. */
  readonly leafLabels: TreeLeafLabels;
};

export type TreeLeafLabels = 'beside' | 'below' | 'turned';

export type TreeLayoutInput = {
  readonly structure: TreeStructure;
  readonly nodes: ReadonlyArray<TreeLayoutNode>;
  readonly direction: TreeDirection;
  readonly link: LinkShape;
  /** The width the frame gives the plot. The layout grows past it, and the plot scrolls, when leaves need more room. */
  readonly width: number;
};

/** The geometry of a tree layout, in CSS pixels. */
const treeGeometry = {
  padding: 16,
  top: 28,
  leafStep: 26,
  leafStepDown: 28,
  depthStep: 96,
  depthStepDown: 80,
  gutterMax: 180,
  gutterMaxDown: 140,
  characterWidth: 6,
  labelGap: 10,
  lineHeight: 20,
  /** Where a parent's label starts, past its dot, in a tree that grows right. The diagram draws it there. */
  labelInset: 8,
  /** The space between a parent's label and the start of its links, and the shortest link before the elbow. */
  trunkGap: 6,
  trunkMin: 12,
  depthStepMin: 72,
} as const;

const HALF = 0.5;

/**
 * A tidy tree: depth sets one axis, leaves are spaced evenly in supplied order along the other, and each parent sits at
 * the middle of its first and last child. Links run from parent to child as curves or elbows.
 */
export function treeLayout({ structure, nodes, direction, link, width }: TreeLayoutInput): TreeLayout {
  const geometry = treeGeometry;
  const isRight = direction === 'right';
  const labels = new Map(nodes.map((node) => [node.id, node.label]));
  const leaves = structure.order.filter((entry) => (structure.children.get(entry.id) ?? []).length === 0);
  const leafIndex = new Map(leaves.map((entry, index) => [entry.id, index]));
  const depthMax = Math.max(1, ...structure.order.map((entry) => entry.depth));
  const longest = Math.max(0, ...leaves.map((entry) => (labels.get(entry.id) ?? '').length));
  const gutterMax = isRight ? geometry.gutterMax : geometry.gutterMaxDown;
  const labelLength = longest * geometry.characterWidth + geometry.labelGap;
  const sides = geometry.padding + geometry.padding;
  const leafCount = Math.max(1, leaves.length);
  const leafStep = isRight ? geometry.leafStep : Math.max(geometry.leafStepDown, (width - sides) / leafCount);
  const isBelow = !isRight && labelLength <= leafStep;
  const downLabels: TreeLeafLabels = isBelow ? 'below' : 'turned';
  const leafLabels: TreeLeafLabels = isRight ? 'beside' : downLabels;
  const gutter = isBelow ? geometry.lineHeight : Math.min(gutterMax, labelLength);
  const leafRoom = isBelow ? leafStep : gutter;

  const parentNeeds = Array.from({ length: depthMax }, (_, depth) => {
    const longestParent = Math.max(
      0,
      ...structure.order
        .filter((entry) => entry.depth === depth && !leafIndex.has(entry.id))
        .map((entry) => (labels.get(entry.id) ?? '').length),
    );

    return longestParent * geometry.characterWidth + geometry.labelInset + geometry.trunkGap + geometry.trunkMin;
  });

  const room = width - sides - gutter;
  const needed = sum(parentNeeds);

  const steps = parentNeeds.map((need) =>
    needed > room
      ? Math.max(geometry.depthStepMin, (need * room) / needed)
      : Math.max(geometry.depthStep, need + (room - needed) / depthMax),
  );

  const depthOffsets = steps.map((_, depth) => sum(steps.slice(0, depth)));
  const across = leafCount * leafStep;
  const along = isRight ? sum(steps) : depthMax * geometry.depthStepDown;

  // Children come after their parent in depth-first order, so the reversed order meets each child before its parent.
  const crossings = new Map<string, number>();

  structure.order.toReversed().map((entry) => {
    const kids = structure.children.get(entry.id) ?? [];
    const first = kids[0];
    const last = kids.at(-1);
    const isLeaf = first === undefined || last === undefined;
    const cross = isLeaf ? (leafIndex.get(entry.id) ?? 0) : (crossOf(first) + crossOf(last)) * HALF;

    return crossings.set(entry.id, cross);
  });

  function crossOf(id: string): number {
    return crossings.get(id) ?? 0;
  }

  function spanOf(id: string): number {
    const kids = structure.children.get(id) ?? [];
    const first = kids[0];
    const last = kids.at(-1);

    return first === undefined || last === undefined ? 1 : crossOf(last) - crossOf(first) + 1;
  }

  const placed = structure.order.map((entry) => {
    const cross = geometry.padding + (crossOf(entry.id) + HALF) * leafStep;

    const depth = isRight
      ? geometry.padding + (depthOffsets[entry.depth] ?? along)
      : geometry.top + entry.depth * geometry.depthStepDown;

    const isLeaf = leafIndex.has(entry.id);
    const step = steps[entry.depth] ?? 0;

    const parentRoom = isRight
      ? step - geometry.labelInset - geometry.trunkGap - geometry.trunkMin
      : spanOf(entry.id) * leafStep * HALF - geometry.labelGap;

    const labelWidth = isLeaf ? leafRoom - geometry.labelGap : parentRoom;
    const labelPx = Math.min(labelWidth, (labels.get(entry.id) ?? '').length * geometry.characterWidth);

    return {
      id: entry.id,
      x: isRight ? depth : cross,
      y: isRight ? cross + geometry.top - geometry.padding : depth,
      depth: entry.depth,
      isLeaf,
      labelWidth,
      trunk: isRight && !isLeaf ? depth + geometry.labelInset + labelPx + geometry.trunkGap : depth,
    };
  });

  const placedNodes = new Map(placed.map((node) => [node.id, node]));

  const links = nodes.flatMap((node) => {
    const child = placedNodes.get(node.id);
    const parent = node.parentId === null ? undefined : placedNodes.get(node.parentId);

    if (child === undefined || parent === undefined || node.parentId === null) {
      return [];
    }

    const path = linkPath({
      x1: isRight ? parent.trunk : parent.x,
      y1: parent.y,
      x2: child.x,
      y2: child.y,
      axis: isRight ? 'x' : 'y',
      shape: link,
    });

    return [{ id: node.id, parentId: node.parentId, d: path }];
  });

  return {
    width: isRight ? geometry.padding + along + gutter + geometry.padding : across + sides,
    height: isRight ? geometry.top + across + geometry.padding : geometry.top + along + gutter + geometry.padding,
    nodes: placedNodes,
    links,
    leafLabels,
  };
}

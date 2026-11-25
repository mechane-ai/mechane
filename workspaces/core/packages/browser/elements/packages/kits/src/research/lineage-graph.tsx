import { useState } from 'react';
import type { ReactNode } from 'react';
import { RelationGraph } from '../../../charts/src/graph/index.ts';
import type { RelationEdge, RelationGroup, RelationNode } from '../../../charts/src/graph/index.ts';
import { formatValue } from '../../../charts/src/index.ts';
import type { ChartTone, FigureProps, FigureSelectionProps, ValueFormat } from '../../../charts/src/index.ts';
import { Details } from '../../../collections/src/index.ts';
import { Badge, Divider, Row, Stack, Text } from '../../../core/src/index.ts';
import { EmptyState, Notice } from '../../../feedback/src/index.ts';
import { SegmentedControl } from '../../../forms/src/index.ts';

export type LineageNodeKind = 'baseline' | 'milestone' | 'branch' | 'merge' | 'killed';

export type LineageNode = {
  readonly id: string;
  readonly parentIds: ReadonlyArray<string>;
  readonly label: string;
  readonly kind: LineageNodeKind;
  readonly lane?: string | undefined;
  /** Optional explicit column index to align parallel swimlanes cleanly without empty gaps. */
  readonly column?: number | undefined;
  readonly metric?: number | null | undefined;
  readonly delta?: number | null | undefined;
  /** Optional short subtitle shown inside the node card. Falls back to metric or summary. */
  readonly caption?: string | undefined;
  readonly summary?: string | undefined;
  readonly detail?: string | undefined;
  readonly source?: string | undefined;
  readonly timestamp?: string | undefined;
};

export type LineageGraphLabels = {
  readonly frontier: string;
  readonly all: string;
  readonly metric: string;
  readonly delta: string;
  readonly lane: string;
  readonly parents: string;
  readonly source: string;
  readonly empty: string;
  readonly kinds: Readonly<Record<LineageNodeKind, string>>;
};

export type LineageGraphProps = Pick<
  FigureProps,
  'title' | 'description' | 'locale' | 'status' | 'source' | 'transforms' | 'actions'
> &
  FigureSelectionProps & {
    readonly nodes: ReadonlyArray<LineageNode>;
    readonly valueLabel?: string | undefined;
    readonly valueFormat?: ValueFormat | undefined;
    readonly deltaFormat?: ValueFormat | undefined;
    readonly defaultScope?: 'frontier' | 'all' | undefined;
    readonly labels?: Partial<LineageGraphLabels> | undefined;
  };

const NODE_WIDTH = 152;
const NODE_HEIGHT = 56;
const COLUMN_GAP = 32;
const ROW_GAP = 12;
const CANVAS_PADDING = 16;
const LANE_TOP_PADDING = 32;
const LANE_BOTTOM_PADDING = 16;
const LANE_PADDING_X = 16;
const LANE_GAP = 12;
const LOADING_WIDTH = 640;
const LOADING_HEIGHT = 240;
const MAX_DEPTH_PASSES = 64;
const DEFAULT_LANE_LABEL = 'General';

const kindTones: Readonly<Record<LineageNodeKind, ChartTone>> = {
  baseline: 'series5',
  milestone: 'positive',
  branch: 'series1',
  merge: 'series3',
  killed: 'negative',
};

const kindBadgeTone: Readonly<Record<LineageNodeKind, 'neutral' | 'positive' | 'warning' | 'negative'>> = {
  baseline: 'neutral',
  milestone: 'positive',
  branch: 'neutral',
  merge: 'warning',
  killed: 'negative',
};

const defaultLabels: LineageGraphLabels = {
  frontier: 'Frontier',
  all: 'All',
  metric: 'Score',
  delta: 'Change',
  lane: 'Track',
  parents: 'Parents',
  source: 'Evidence',
  empty: 'No lineage nodes recorded.',
  kinds: { baseline: 'Baseline', milestone: 'Milestone', branch: 'Branch', merge: 'Merge', killed: 'Killed' },
};

function nextNodeDepth(
  node: LineageNode,
  depthById: ReadonlyMap<string, number>,
  visibleIds: ReadonlySet<string>,
): number {
  let nextDepth = depthById.get(node.id) ?? 0;

  for (const parentId of node.parentIds) {
    if (visibleIds.has(parentId)) {
      const parentDepth = (depthById.get(parentId) ?? 0) + 1;

      if (parentDepth > nextDepth) {
        nextDepth = parentDepth;
      }
    }
  }

  return nextDepth;
}

function computeDepths(nodes: ReadonlyArray<LineageNode>): ReadonlyMap<string, number> {
  const depthById = new Map<string, number>();
  const visibleIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    depthById.set(node.id, 0);
  }

  for (let pass = 0; pass < MAX_DEPTH_PASSES; pass += 1) {
    const updates: Array<readonly [string, number]> = [];

    for (const node of nodes) {
      const nextDepth = nextNodeDepth(node, depthById, visibleIds);

      if (nextDepth !== depthById.get(node.id)) {
        updates.push([node.id, nextDepth]);
      }
    }

    if (updates.length === 0) {
      break;
    }

    for (const [id, depth] of updates) {
      depthById.set(id, depth);
    }
  }

  return depthById;
}

function selectFrontierNodes(nodes: ReadonlyArray<LineageNode>): ReadonlyArray<LineageNode> {
  const activeAncestorIds = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  function markAncestors(nodeId: string): void {
    if (activeAncestorIds.has(nodeId)) {
      return;
    }

    activeAncestorIds.add(nodeId);

    const node = byId.get(nodeId);

    if (node === undefined) {
      return;
    }

    for (const parentId of node.parentIds) {
      markAncestors(parentId);
    }
  }

  for (const node of nodes) {
    if (node.kind !== 'killed') {
      markAncestors(node.id);
    }
  }

  return nodes.filter((node) => activeAncestorIds.has(node.id));
}

function formatNodeMetric({
  node,
  locale,
  valueFormat,
  deltaFormat,
}: {
  readonly node: LineageNode;
  readonly locale: string;
  readonly valueFormat: ValueFormat | undefined;
  readonly deltaFormat: ValueFormat | undefined;
}): string | undefined {
  const parts: Array<string> = [];

  if (node.metric !== null && node.metric !== undefined) {
    parts.push(
      valueFormat === undefined
        ? String(node.metric)
        : formatValue({ value: node.metric, locale, format: valueFormat }),
    );
  }

  if (node.delta !== null && node.delta !== undefined) {
    const resolvedDeltaFormat = deltaFormat ?? valueFormat;

    if (resolvedDeltaFormat === undefined) {
      parts.push(node.delta > 0 ? `+${node.delta}` : String(node.delta));
    } else {
      parts.push(formatValue({ value: node.delta, locale, format: resolvedDeltaFormat }));
    }
  }

  if (node.caption !== undefined) {
    return node.caption;
  }

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  return node.summary;
}

function resolveColumns(nodes: ReadonlyArray<LineageNode>): ReadonlyMap<string, number> {
  const depthById = computeDepths(nodes);
  const columnById = new Map<string, number>();

  for (const node of nodes) {
    columnById.set(node.id, node.column ?? depthById.get(node.id) ?? 0);
  }

  return columnById;
}

function layoutLineageGraph({
  nodes,
  locale,
  valueFormat,
  deltaFormat,
}: {
  readonly nodes: ReadonlyArray<LineageNode>;
  readonly locale: string;
  readonly valueFormat: ValueFormat | undefined;
  readonly deltaFormat: ValueFormat | undefined;
}): {
  readonly relationNodes: ReadonlyArray<RelationNode>;
  readonly relationEdges: ReadonlyArray<RelationEdge>;
  readonly relationGroups: ReadonlyArray<RelationGroup>;
  readonly width: number;
  readonly height: number;
} {
  const depthById = resolveColumns(nodes);
  const maxDepth = Math.max(0, ...Array.from(depthById.values()));
  const hasLanes = nodes.some((node) => node.lane !== undefined);
  const laneOrder: Array<string> = [];

  if (hasLanes) {
    for (const node of nodes) {
      const laneName = node.lane ?? DEFAULT_LANE_LABEL;

      if (!laneOrder.includes(laneName)) {
        laneOrder.push(laneName);
      }
    }
  } else {
    laneOrder.push(DEFAULT_LANE_LABEL);
  }

  const columnSpan = NODE_WIDTH + COLUMN_GAP;
  const contentWidth = (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP;
  const relationNodes: Array<RelationNode> = [];
  const relationGroups: Array<RelationGroup> = [];
  let cursorY = CANVAS_PADDING;

  for (const laneName of laneOrder) {
    const laneNodes = hasLanes ? nodes.filter((node) => (node.lane ?? DEFAULT_LANE_LABEL) === laneName) : nodes;
    const byColumn = new Map<number, Array<LineageNode>>();

    for (const node of laneNodes) {
      const col = depthById.get(node.id) ?? 0;
      const columnNodes = byColumn.get(col) ?? [];

      columnNodes.push(node);
      byColumn.set(col, columnNodes);
    }

    const maxRows = Math.max(1, ...Array.from(byColumn.values(), (columnNodes) => columnNodes.length));
    const innerHeight = maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP;
    const laneTop = cursorY;
    const nodesTop = hasLanes ? laneTop + LANE_TOP_PADDING : laneTop;
    const laneHeight = hasLanes ? LANE_TOP_PADDING + innerHeight + LANE_BOTTOM_PADDING : innerHeight;

    for (const [col, columnNodes] of byColumn.entries()) {
      const nodeX = CANVAS_PADDING + (hasLanes ? LANE_PADDING_X : 0) + col * columnSpan;

      for (const [rowIndex, node] of columnNodes.entries()) {
        const nodeY = nodesTop + rowIndex * (NODE_HEIGHT + ROW_GAP);

        relationNodes.push({
          id: node.id,
          label: node.label,
          description: formatNodeMetric({ node, locale, valueFormat, deltaFormat }),
          x: nodeX,
          y: nodeY,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          tone: kindTones[node.kind],
        });
      }
    }

    if (hasLanes) {
      relationGroups.push({
        id: `lane:${laneName}`,
        label: laneName,
        x: CANVAS_PADDING,
        y: laneTop,
        width: contentWidth + LANE_PADDING_X * 2,
        height: laneHeight,
        nodeIds: laneNodes.map((node) => node.id),
      });
    }

    cursorY = laneTop + laneHeight + (hasLanes ? LANE_GAP : ROW_GAP);
  }

  const visibleIds = new Set(nodes.map((node) => node.id));
  const relationEdges: Array<RelationEdge> = [];

  for (const node of nodes) {
    for (const parentId of node.parentIds) {
      if (visibleIds.has(parentId)) {
        relationEdges.push({
          id: `${parentId}->${node.id}`,
          sourceId: parentId,
          targetId: node.id,
          label: `${parentId} to ${node.id}`,
          direction: 'directed',
        });
      }
    }
  }

  const width = contentWidth + CANVAS_PADDING * 2 + (hasLanes ? LANE_PADDING_X * 2 : 0);
  const height = Math.max(LOADING_HEIGHT, cursorY + CANVAS_PADDING - (hasLanes ? LANE_GAP : ROW_GAP));

  return { relationNodes, relationEdges, relationGroups, width, height };
}

function LineageReadout({
  node,
  labels,
  detailItems,
}: {
  readonly node: LineageNode;
  readonly labels: LineageGraphLabels;
  readonly detailItems: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}): ReactNode {
  return (
    <Stack isCompact>
      <Divider />
      <Row shouldSpaceBetween>
        <Row>
          <Text>
            <strong>{node.label}</strong>
          </Text>
          {node.timestamp === undefined ? null : <Badge tone="neutral">{node.timestamp}</Badge>}
        </Row>
        <Badge tone={kindBadgeTone[node.kind]}>{labels.kinds[node.kind]}</Badge>
      </Row>
      {node.summary === undefined ? null : <Text>{node.summary}</Text>}
      {node.detail === undefined ? null : <Text tone="muted">{node.detail}</Text>}
      {detailItems.length === 0 ? null : <Details items={detailItems} />}
    </Stack>
  );
}

/**
 * Multi-parent research lineage DAG with automatic topological layout, optional agent swimlanes, and a Frontier / All
 * scope switcher. Composes `RelationGraph` with a flat inline evidence readout for the selected node.
 */
export function LineageGraph({
  nodes,
  valueLabel,
  valueFormat,
  deltaFormat,
  defaultScope = 'frontier',
  selected,
  onSelectedChange,
  labels: given,
  actions,
  ...figure
}: LineageGraphProps): ReactNode {
  const [scope, setScope] = useState<'frontier' | 'all'>(defaultScope);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const labels: LineageGraphLabels = { ...defaultLabels, ...given, kinds: { ...defaultLabels.kinds, ...given?.kinds } };

  if (figure.status === 'loading') {
    return <RelationGraph {...figure} nodes={[]} edges={[]} width={LOADING_WIDTH} height={LOADING_HEIGHT} />;
  }

  if (nodes.length === 0) {
    return <EmptyState title={figure.title}>{labels.empty}</EmptyState>;
  }

  const ids = new Set(nodes.map((node) => node.id));

  if (ids.size !== nodes.length) {
    return <Notice hasError>Lineage nodes must have unique identifiers.</Notice>;
  }

  const frontierNodes = selectFrontierNodes(nodes);
  const hasFoldedNodes = frontierNodes.length < nodes.length;
  const visibleNodes = scope === 'frontier' && hasFoldedNodes ? frontierNodes : nodes;
  const activeSelected = selected === undefined ? internalSelected : selected;

  function handleSelect(
    nextId: string,
    details: Parameters<NonNullable<FigureSelectionProps['onSelectedChange']>>[1],
  ): void {
    if (selected === undefined) {
      setInternalSelected(nextId);
    }

    onSelectedChange?.(nextId, details);
  }

  const layout = layoutLineageGraph({ nodes: visibleNodes, locale: figure.locale, valueFormat, deltaFormat });

  const selectedNode = activeSelected === null ? undefined : visibleNodes.find((node) => node.id === activeSelected);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const scopeActions = hasFoldedNodes ? (
    <>
      <SegmentedControl.Root
        aria-label={`${figure.title} scope`}
        value={scope}
        onValueChange={(value) => setScope(value === 'all' ? 'all' : 'frontier')}
      >
        <SegmentedControl.Item value="frontier">{`${labels.frontier} (${frontierNodes.length})`}</SegmentedControl.Item>
        <SegmentedControl.Item value="all">{`${labels.all} (${nodes.length})`}</SegmentedControl.Item>
      </SegmentedControl.Root>
      {actions}
    </>
  ) : (
    actions
  );

  const detailItems =
    selectedNode === undefined
      ? []
      : [
          ...(selectedNode.lane === undefined ? [] : [{ label: labels.lane, value: selectedNode.lane }]),
          ...(selectedNode.metric === null || selectedNode.metric === undefined
            ? []
            : [
                {
                  label: valueLabel ?? labels.metric,
                  value:
                    valueFormat === undefined
                      ? String(selectedNode.metric)
                      : formatValue({ value: selectedNode.metric, locale: figure.locale, format: valueFormat }),
                },
              ]),
          ...(selectedNode.delta === null || selectedNode.delta === undefined
            ? []
            : [
                {
                  label: labels.delta,
                  value:
                    (deltaFormat ?? valueFormat) === undefined
                      ? selectedNode.delta > 0
                        ? `+${selectedNode.delta}`
                        : String(selectedNode.delta)
                      : formatValue({
                          value: selectedNode.delta,
                          locale: figure.locale,
                          format: deltaFormat ?? valueFormat ?? { style: 'decimal' },
                        }),
                },
              ]),
          ...(selectedNode.parentIds.length === 0
            ? []
            : [
                {
                  label: labels.parents,
                  value: selectedNode.parentIds.map((parentId) => byId.get(parentId)?.label ?? parentId).join(', '),
                },
              ]),
          ...(selectedNode.source === undefined ? [] : [{ label: labels.source, value: selectedNode.source }]),
        ];

  return (
    <Stack>
      <RelationGraph
        {...figure}
        actions={scopeActions}
        nodes={layout.relationNodes}
        edges={layout.relationEdges}
        groups={layout.relationGroups.length > 0 ? layout.relationGroups : undefined}
        width={layout.width}
        height={layout.height}
        selected={activeSelected}
        onSelectedChange={handleSelect}
      />
      {selectedNode === undefined ? null : (
        <LineageReadout node={selectedNode} labels={labels} detailItems={detailItems} />
      )}
    </Stack>
  );
}

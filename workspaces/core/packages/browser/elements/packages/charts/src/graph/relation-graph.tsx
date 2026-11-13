import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../../foundations/src/use-scroll-tab-index.ts';
import { ChartDataDisclosure, ChartDatumButton, ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { chartToneColors } from '../chart-theme.ts';
import type { ChartTone } from '../chart-theme.ts';

export type RelationNode = {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tone: ChartTone;
};

export type RelationEdge = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly label: string;
  readonly direction: 'directed' | 'undirected';
};

export type RelationGroup = {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly nodeIds: ReadonlyArray<string>;
};

export type RelationGraphProps = {
  readonly title: string;
  readonly description: string;
  readonly nodes: ReadonlyArray<RelationNode>;
  readonly edges: ReadonlyArray<RelationEdge>;
  readonly groups?: ReadonlyArray<RelationGroup> | undefined;
  readonly width: number;
  readonly height: number;
  readonly selection?: ChartSelection | undefined;
  readonly emptyLabel: string;
};

type LinkedRelation = { readonly edge: RelationEdge; readonly source: RelationNode; readonly target: RelationNode };

const styles = stylex.create({
  viewport: {
    'overflow': 'auto',
    'maxHeight': 520,
    'minWidth': 0,
    'outlineStyle': 'none',
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
  },
  canvas: (width: number, height: number) => ({ position: 'relative', width, height }),
  svg: { position: 'absolute', inset: 0, display: 'block' },
  group: { fill: colors.canvas, stroke: colors.line, strokeWidth: 1 },
  groupLabel: { fill: colors.muted, fontFamily: typography.fontFamily, fontSize: typography.captionSize },
  edge: { fill: 'none', stroke: colors.faint, strokeWidth: 1.5 },
  arrow: { fill: colors.faint },
  node: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxSizing: 'border-box',
    paddingInline: spacing.md,
    paddingBlock: spacing.sm,
    gap: spacing.xxs,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderLeftWidth: 3,
    color: colors.ink,
    backgroundColor: colors.surface,
    textAlign: 'start',
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    minHeight: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
  },
  position: (left: number, top: number) => ({ left, top }),
  size: (width: number, height: number) => ({ width, height }),
  tone: (color: string) => ({ borderLeftColor: color }),
  action: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
  },
  selected: { outlineWidth: controls.focusWidth, outlineColor: colors.focus, outlineStyle: 'solid', outlineOffset: -2 },
  label: {
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.mediumWeight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  detail: {
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  list: { paddingInlineStart: spacing.lg, marginBlock: spacing.sm, color: colors.muted, overflowWrap: 'anywhere' },
  data: { margin: 0, padding: 0, listStyle: 'none' },
  record: { display: 'grid', gap: spacing.xxs, minWidth: 0, width: '100%' },
  recordDetail: { color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  empty: { margin: 0, color: colors.muted },
});

export const MAX_RELATION_NODES = 256;
export const MAX_RELATION_EDGES = 1024;
export const MAX_RELATION_GROUPS = 256;
export const MAX_RELATION_DIMENSION = 8192;

export function RelationGraph({
  title,
  description,
  nodes,
  edges,
  groups = [],
  width,
  height,
  selection,
  emptyLabel,
}: RelationGraphProps): ReactNode {
  const markerId = useId();
  const scroll = useScrollTabIndex<HTMLDivElement>();
  const problem = graphProblem({ nodes, edges, groups, width, height });

  if (problem !== null) {
    return <ChartInputError title={title} description={description} message={problem} />;
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const links = resolveRelationships(edges, nodeMap);
  const selected = selection?.selectedId === undefined ? undefined : nodeMap.get(selection.selectedId);
  const hasNodes = nodes.length > 0;

  if (links === null) {
    return (
      <ChartInputError
        title={title}
        description={description}
        message="Every relationship must refer to two supplied nodes."
      />
    );
  }

  return (
    <ChartFrame
      title={title}
      description={description}
      footer={
        selection !== undefined && hasNodes ? (
          <ChartReadout>
            {selected === undefined
              ? 'Select a node to inspect its record.'
              : [selected.label, selected.description].filter((part) => part !== undefined).join(' · ')}
          </ChartReadout>
        ) : undefined
      }
    >
      {hasNodes ? (
        <div
          ref={scroll.ref}
          role="region"
          aria-label={`${title} graph`}
          tabIndex={scroll.tabIndex}
          {...stylex.props(styles.viewport)}
        >
          <div {...stylex.props(styles.canvas(width, height))}>
            <svg width={width} height={height} aria-hidden {...stylex.props(styles.svg)}>
              <defs>
                <marker
                  id={markerId}
                  markerWidth={8}
                  markerHeight={8}
                  refX={7}
                  refY={4}
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L8,4 L0,8 Z" {...stylex.props(styles.arrow)} />
                </marker>
              </defs>
              {groups.map((group) => (
                <g key={group.id}>
                  <rect
                    x={group.x}
                    y={group.y}
                    width={group.width}
                    height={group.height}
                    {...stylex.props(styles.group)}
                  />
                  <svg x={group.x} y={group.y} width={group.width} height={group.height} overflow="hidden">
                    <text x={12} y={20} {...stylex.props(styles.groupLabel)}>
                      {group.label}
                    </text>
                  </svg>
                </g>
              ))}
              {links.map(({ edge, source, target }) => {
                const isForward = source.x < target.x;
                const startX = source.x + (isForward ? source.width : 0);
                const endX = target.x + (isForward ? 0 : target.width);
                const startY = source.y + source.height / 2;
                const endY = target.y + target.height / 2;
                const middleX = (startX + endX) / 2;
                const loopX = source.x + source.width / 2;

                const path =
                  source.id === target.id
                    ? `M${loopX - 12},${source.y} C${loopX - 48},${source.y - 36} ${loopX + 48},${source.y - 36} ${loopX + 12},${source.y}`
                    : `M${startX},${startY} C${middleX},${startY} ${middleX},${endY} ${endX},${endY}`;

                return (
                  <path
                    key={edge.id}
                    d={path}
                    markerEnd={edge.direction === 'directed' ? `url(#${markerId})` : undefined}
                    {...stylex.props(styles.edge)}
                  >
                    <title>{edge.label}</title>
                  </path>
                );
              })}
            </svg>
            {nodes.map((node) => {
              const groupLabels = groups.filter((group) => group.nodeIds.includes(node.id)).map((group) => group.label);

              const accessibleLabel = [...groupLabels, node.label, node.description]
                .filter((part) => part !== undefined)
                .join(', ');

              const appearance = stylex.props(
                styles.node,
                styles.position(node.x, node.y),
                styles.size(node.width, node.height),
                styles.tone(chartToneColors[node.tone]),
                selection !== undefined && styles.action,
                selection?.selectedId === node.id && styles.selected,
              );

              const content = (
                <>
                  <span {...stylex.props(styles.label)}>{node.label}</span>
                  {node.description !== undefined && node.height >= 56 && (
                    <span {...stylex.props(styles.detail)}>{node.description}</span>
                  )}
                </>
              );

              return selection === undefined ? (
                <div key={node.id} role="group" aria-label={accessibleLabel} title={accessibleLabel} {...appearance}>
                  {content}
                </div>
              ) : (
                <button
                  key={node.id}
                  type="button"
                  aria-label={accessibleLabel}
                  title={accessibleLabel}
                  aria-pressed={selection.selectedId === node.id}
                  onClick={() => selection.onSelect(node.id)}
                  {...appearance}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
      )}
      {hasNodes ? (
        <ChartDataDisclosure label="Graph data">
          <ul aria-label="Nodes" {...stylex.props(styles.data)}>
            {nodes.map((node) => (
              <li key={node.id}>
                <ChartDatumButton
                  label={[node.label, node.description].filter((part) => part !== undefined).join(', ')}
                  isSelected={selection?.selectedId === node.id}
                  onSelect={selection === undefined ? undefined : () => selection.onSelect(node.id)}
                >
                  <span {...stylex.props(styles.record)}>
                    <span>{node.label}</span>
                    {node.description !== undefined && (
                      <span {...stylex.props(styles.recordDetail)}>{node.description}</span>
                    )}
                  </span>
                </ChartDatumButton>
              </li>
            ))}
          </ul>
          {groups.length > 0 && (
            <ul aria-label="Groups" {...stylex.props(styles.list)}>
              {groups.map((group) => (
                <li key={group.id}>
                  {group.label}: {group.nodeIds.map((nodeId) => nodeMap.get(nodeId)?.label).join(', ')}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul aria-label="Relationships" {...stylex.props(styles.list)}>
              {links.map(({ edge, source, target }) => (
                <li key={edge.id}>
                  {source.label} {edge.direction === 'directed' ? '→' : '↔'} {target.label}: {edge.label}
                </li>
              ))}
            </ul>
          )}
        </ChartDataDisclosure>
      ) : null}
    </ChartFrame>
  );
}

function graphProblem({
  nodes,
  edges,
  groups,
  width,
  height,
}: Required<Pick<RelationGraphProps, 'nodes' | 'edges' | 'width' | 'height'>> & {
  readonly groups: ReadonlyArray<RelationGroup>;
}): string | null {
  const hasInvalidWidth = !Number.isFinite(width) || width <= 0 || width > MAX_RELATION_DIMENSION;
  const hasInvalidHeight = !Number.isFinite(height) || height <= 0 || height > MAX_RELATION_DIMENSION;

  if (hasInvalidWidth || hasInvalidHeight) {
    return `Graph dimensions must be finite, positive, and at most ${MAX_RELATION_DIMENSION} pixels.`;
  }

  if (nodes.length > MAX_RELATION_NODES || edges.length > MAX_RELATION_EDGES || groups.length > MAX_RELATION_GROUPS) {
    return `This graph exceeds the render limit of ${MAX_RELATION_NODES} nodes, ${MAX_RELATION_EDGES} relationships, or ${MAX_RELATION_GROUPS} groups. Supply a smaller, labelled neighborhood.`;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  if (!hasUniqueIds(nodes) || !hasUniqueIds(edges) || !hasUniqueIds(groups)) {
    return 'Graph nodes, relationships, and groups must have unique identifiers.';
  }

  const boxes = [...nodes, ...groups];

  if (
    boxes.some((box) => {
      const hasNonfiniteSize = !Number.isFinite(box.width) || !Number.isFinite(box.height);

      if (hasNonfiniteSize || box.width <= 0 || box.height <= 0) {
        return true;
      }

      const hasInvalidHorizontalBounds = !Number.isFinite(box.x) || box.x < 0 || box.x + box.width > width;
      const hasInvalidVerticalBounds = !Number.isFinite(box.y) || box.y < 0 || box.y + box.height > height;

      return hasInvalidHorizontalBounds || hasInvalidVerticalBounds;
    })
  ) {
    return 'Graph boxes must have finite, positive dimensions and fit inside the supplied canvas.';
  }

  if (nodes.some((node) => node.width < 44 || node.height < 44)) {
    return 'Graph node boxes must be at least 44 by 44 pixels.';
  }

  if (
    edges.some(
      (edge) => edge.sourceId === edge.targetId && nodes.some((node) => node.id === edge.sourceId && node.y < 36),
    )
  ) {
    return 'A self-relationship needs at least 36 pixels of space above its node.';
  }

  if (
    groups.some(
      (group) =>
        new Set(group.nodeIds).size !== group.nodeIds.length || group.nodeIds.some((nodeId) => !nodeIds.has(nodeId)),
    )
  ) {
    return 'Each group must contain unique references to supplied nodes.';
  }

  if (
    groups.some((group) =>
      group.nodeIds.some((nodeId) => {
        const node = nodes.find((item) => item.id === nodeId);

        if (node === undefined) {
          return false;
        }

        const isOutsideHorizontalBounds = node.x < group.x || node.x + node.width > group.x + group.width;
        const isOutsideVerticalBounds = node.y < group.y || node.y + node.height > group.y + group.height;

        return isOutsideHorizontalBounds || isOutsideVerticalBounds;
      }),
    )
  ) {
    return 'A group box must contain the node boxes assigned to it.';
  }

  return null;
}

function resolveRelationships(
  edges: ReadonlyArray<RelationEdge>,
  nodes: ReadonlyMap<string, RelationNode>,
): ReadonlyArray<LinkedRelation> | null {
  const links: Array<LinkedRelation> = [];

  for (const edge of edges) {
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);

    if (source === undefined || target === undefined) {
      return null;
    }

    links.push({ edge, source, target });
  }

  return links;
}

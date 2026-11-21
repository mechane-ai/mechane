import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import { colors, controls, motion, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { useChartNavigation } from '../chart-navigation.tsx';
import { ChartSurface } from '../chart-surface.tsx';
import { chartStyles } from '../chart-theme.ts';
import { spreadPositions } from '../label-spacing.ts';
import { usePlotWidth } from '../plot-width.ts';
import { FLOW_NODE_WIDTH_PX, flowColumns, layoutFlow, ribbonPath, threadPath } from './flow-layout.ts';
import type { FlowLink, FlowNode, PlacedFlowLink, PlacedFlowNode } from './flow-layout.ts';

export type { FlowLink, FlowNode } from './flow-layout.ts';

export type FlowDiagramProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly report?: ChartReport | undefined;
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
  /** Formats every amount exactly, for labels, inspection and accessible values. */
  readonly formatValue: (value: number) => string;
  /** Controlled selection of a node or link identifier, activated by click, Enter or Space. */
  readonly selection?: ChartSelection | undefined;
  /** The plot height in pixels. Absent fits the busiest column. */
  readonly height?: number | undefined;
  readonly emptyLabel?: string | undefined;
};

const styles = stylex.create({
  surface: {
    'minWidth': 0,
    'marginBlock': spacing.md,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  svg: { display: 'block', width: '100%', overflow: 'visible' },
  ribbon: (color: string) => ({ fill: color, fillOpacity: 0.34 }),
  thread: (color: string) => ({ fill: 'none', stroke: color, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' }),
  unavailable: { strokeDasharray: '4 3' },
  node: (color: string, outline: string) => ({ fill: color, stroke: outline, strokeWidth: 1 }),
  lit: { fillOpacity: 0.62 },
  dim: { opacity: 0.2 },
  transition: {
    transitionProperty: 'opacity',
    transitionDuration: { 'default': motion.duration, '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: motion.easing,
  },
  selected: { stroke: colors.ink, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' },
  interactive: { cursor: 'pointer' },
  empty: { margin: 0, color: colors.muted, fontSize: typography.captionSize },
});

export const MAX_FLOW_NODES = 64;
export const MAX_FLOW_LINKS = 256;
const PLOT_PADDING_PX = 8;
const LABEL_GAP_PX = 8;
const LABEL_SPACING_PX = 16;
const CHARACTER_WIDTH_PX = 6.5;
const LABEL_CHARACTERS_MAX = 22;
const GUTTER_MAX_PX = 180;
const ROW_HEIGHT_PX = 48;
const MIN_HEIGHT_PX = 240;
const SMALLEST_HEIGHT_PX = 96;

function validateFlow({
  nodes,
  links,
}: {
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
}): string | undefined {
  if (nodes.length > MAX_FLOW_NODES || links.length > MAX_FLOW_LINKS) {
    return `This flow exceeds the render limit of ${MAX_FLOW_NODES} nodes or ${MAX_FLOW_LINKS} links. Supply a smaller, labelled grouping.`;
  }

  if (!hasUniqueIds([...nodes, ...links])) {
    return 'Flow nodes and links require distinct, unique identifiers.';
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const link of links) {
    const isConnected = nodeIds.has(link.sourceId) && nodeIds.has(link.targetId) && link.sourceId !== link.targetId;

    if (!isConnected) {
      return 'Every flow link must join two different supplied nodes.';
    }

    if (link.value !== null && (!Number.isFinite(link.value) || link.value < 0)) {
      return 'Flow amounts must be finite and nonnegative, or explicitly unavailable.';
    }
  }

  return flowColumns({ nodes, links }) === undefined ? 'Flow links must not form a cycle.' : undefined;
}

function shortLabel(label: string): string {
  return label.length > LABEL_CHARACTERS_MAX ? `${label.slice(0, LABEL_CHARACTERS_MAX - 1)}…` : label;
}

function nodeAmount(placed: PlacedFlowNode): number {
  return Math.max(placed.inflow, placed.outflow);
}

function nodeValueText({
  placed,
  formatValue,
}: {
  readonly placed: PlacedFlowNode;
  readonly formatValue: (value: number) => string;
}): string {
  const isPassing = placed.inflow > 0 && placed.outflow > 0 && placed.inflow !== placed.outflow;

  const amounts = isPassing
    ? `in ${formatValue(placed.inflow)}, out ${formatValue(placed.outflow)}`
    : formatValue(nodeAmount(placed));

  return placed.hasUnavailable ? `${amounts}, with an unavailable amount` : amounts;
}

function linkText({
  placed,
  formatValue,
}: {
  readonly placed: PlacedFlowLink;
  readonly formatValue: (value: number) => string;
}): string {
  const amount = placed.link.value === null ? 'Unavailable' : formatValue(placed.link.value);

  return `${placed.source.node.label} → ${placed.target.node.label}: ${amount}`;
}

/** The width that one column's outside labels need, as name and amount on one line. */
function labelGutter({
  nodes,
  links,
  formatValue,
}: {
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
  readonly formatValue: (value: number) => string;
}): number {
  const characters = nodes.map((node) => {
    const incoming = links
      .filter((link) => link.targetId === node.id)
      .reduce((sum, link) => sum + (link.value ?? 0), 0);

    const outgoing = links
      .filter((link) => link.sourceId === node.id)
      .reduce((sum, link) => sum + (link.value ?? 0), 0);

    const total = Math.max(incoming, outgoing);

    return shortLabel(node.label).length + formatValue(total).length + 1;
  });

  return Math.min(GUTTER_MAX_PX, Math.max(0, ...characters) * CHARACTER_WIDTH_PX + LABEL_GAP_PX);
}

/**
 * Shows how supplied amounts divide and move between stages, such as a total splitting into categories and their parts.
 * Node height and ribbon width share one scale; columns follow the links and keep the supplied order. Use BreakdownBar
 * for one level of parts and RelationGraph for unweighted relationships; the diagram never infers or balances a flow.
 */
export function FlowDiagram({
  title,
  description,
  report,
  nodes,
  links,
  formatValue,
  selection,
  height,
  emptyLabel = 'No flows',
}: FlowDiagramProps): ReactNode {
  const { ref, width } = usePlotWidth();
  const issue = validateFlow({ nodes, links });
  const columnOf = (issue === undefined ? flowColumns({ nodes, links }) : undefined) ?? new Map<string, number>();
  const lastColumn = Math.max(0, ...columnOf.values());

  const columnSizes = Array.from(
    { length: lastColumn + 1 },
    (_, column) => nodes.filter((node) => columnOf.get(node.id) === column).length,
  );

  const plotHeight = height ?? Math.max(MIN_HEIGHT_PX, Math.max(...columnSizes) * ROW_HEIGHT_PX);
  const firstNodes = lastColumn === 0 ? [] : nodes.filter((node) => columnOf.get(node.id) === 0);
  const lastNodes = nodes.filter((node) => columnOf.get(node.id) === lastColumn);
  const startGutter = labelGutter({ nodes: firstNodes, links, formatValue });
  const endGutter = labelGutter({ nodes: lastNodes, links, formatValue });

  const layout = layoutFlow({
    nodes: issue === undefined ? nodes : [],
    links: issue === undefined ? links : [],
    left: startGutter,
    right: Math.max(startGutter + FLOW_NODE_WIDTH_PX, width - endGutter),
    top: PLOT_PADDING_PX,
    bottom: plotHeight - PLOT_PADDING_PX,
  });

  const items = layout.nodes.flatMap((placed) => [
    { id: placed.node.id, label: `${placed.node.label}: ${nodeValueText({ placed, formatValue })}` },
    ...layout.links
      .filter((link) => link.source.node.id === placed.node.id)
      .map((link) => ({ id: link.link.id, label: linkText({ placed: link, formatValue }) })),
  ]);

  const navigation = useChartNavigation({ title, selection, items });

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} report={report} message={issue} />;
  }

  if (!Number.isFinite(plotHeight) || plotHeight < SMALLEST_HEIGHT_PX) {
    return (
      <ChartInputError
        title={title}
        description={description}
        report={report}
        message={`Flow height must be at least ${SMALLEST_HEIGHT_PX} pixels.`}
      />
    );
  }

  const activeId = navigation.label === undefined ? undefined : navigation.activeId;
  const activeLink = layout.links.find((placed) => placed.link.id === activeId);
  const activeNode = layout.nodes.find((placed) => placed.node.id === activeId);

  function isLinkLit(placed: PlacedFlowLink): boolean {
    if (activeLink !== undefined) {
      return activeLink.link.id === placed.link.id;
    }

    return activeNode !== undefined && [placed.source.node.id, placed.target.node.id].includes(activeNode.node.id);
  }

  function isNodeLit(placed: PlacedFlowNode): boolean {
    if (activeLink !== undefined) {
      return [activeLink.source.node.id, activeLink.target.node.id].includes(placed.node.id);
    }

    if (activeNode === undefined) {
      return true;
    }

    return (
      activeNode.node.id === placed.node.id ||
      layout.links.some(
        (link) => isLinkLit(link) && [link.source.node.id, link.target.node.id].includes(placed.node.id),
      )
    );
  }

  const isFocused = activeId !== undefined;

  function interaction(id: string) {
    return { onPointerEnter: () => navigation.inspect(id), onClick: () => selection?.onSelect(id) };
  }

  return (
    <ChartFrame
      title={title}
      description={description}
      report={report}
      footer={<ChartReadout id={navigation.id}>{navigation.label ?? ' '}</ChartReadout>}
    >
      <ChartData
        label={`${title} flows`}
        columns={[
          { id: 'item', label: 'Item' },
          { id: 'amount', label: 'Amount' },
        ]}
        rows={[
          ...layout.nodes.map((placed) => ({
            id: `node:${placed.node.id}`,
            values: [placed.node.label, nodeValueText({ placed, formatValue })],
          })),
          ...layout.links.map((placed) => ({
            id: `link:${placed.link.id}`,
            values: [
              `${placed.source.node.label} → ${placed.target.node.label}`,
              placed.link.value === null ? 'Unavailable' : formatValue(placed.link.value),
            ],
          })),
        ]}
      />
      <div ref={ref}>
        {nodes.length === 0 ? (
          <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
        ) : (
          <ChartSurface {...navigation.props} {...stylex.props(styles.surface)}>
            <svg aria-hidden viewBox={`0 0 ${width} ${plotHeight}`} height={plotHeight} {...stylex.props(styles.svg)}>
              <g>
                {layout.links.map((placed) => {
                  const color = chartToneColors[placed.tone];
                  const isLit = isLinkLit(placed);
                  const hasWidth = placed.width > 0;
                  const isSelected = selection?.selectedId === placed.link.id;

                  return (
                    <path
                      key={placed.link.id}
                      d={hasWidth ? ribbonPath(placed) : threadPath(placed)}
                      {...interaction(placed.link.id)}
                      {...stylex.props(
                        hasWidth ? styles.ribbon(color) : styles.thread(color),
                        placed.link.value === null && styles.unavailable,
                        styles.transition,
                        isLit && hasWidth && styles.lit,
                        isFocused && !isLit && styles.dim,
                        isSelected && styles.selected,
                        selection !== undefined && styles.interactive,
                      )}
                    />
                  );
                })}
              </g>
              {layout.nodes.map((placed) => (
                <rect
                  key={placed.node.id}
                  x={placed.x}
                  y={placed.y}
                  width={FLOW_NODE_WIDTH_PX}
                  height={placed.height}
                  {...interaction(placed.node.id)}
                  {...stylex.props(
                    styles.node(chartToneColors[placed.tone], chartToneOutlines[placed.tone]),
                    styles.transition,
                    isFocused && !isNodeLit(placed) && styles.dim,
                    selection?.selectedId === placed.node.id && styles.selected,
                    selection !== undefined && styles.interactive,
                  )}
                />
              ))}
              <FlowLabels
                nodes={layout.nodes}
                columnCount={layout.columnCount}
                top={PLOT_PADDING_PX}
                bottom={plotHeight - PLOT_PADDING_PX}
                formatValue={formatValue}
                isLit={(placed) => !isFocused || isNodeLit(placed)}
              />
            </svg>
          </ChartSurface>
        )}
      </div>
    </ChartFrame>
  );
}

function FlowLabels({
  nodes,
  columnCount,
  top,
  bottom,
  formatValue,
  isLit,
}: {
  readonly nodes: ReadonlyArray<PlacedFlowNode>;
  readonly columnCount: number;
  readonly top: number;
  readonly bottom: number;
  readonly formatValue: (value: number) => string;
  readonly isLit: (placed: PlacedFlowNode) => boolean;
}): ReactNode {
  const columns = Array.from({ length: columnCount }, (_, column) =>
    nodes.filter((placed) => placed.column === column),
  );

  return (
    <g>
      {columns.map((column, columnIndex) => {
        const isFirst = columnIndex === 0 && columnCount > 1;

        const centers = spreadPositions({
          positions: column.map((placed) => placed.y + placed.height / 2),
          gap: LABEL_SPACING_PX,
          start: top,
          end: bottom,
        });

        return column.map((placed, index) => (
          <text
            key={placed.node.id}
            x={isFirst ? placed.x - LABEL_GAP_PX : placed.x + FLOW_NODE_WIDTH_PX + LABEL_GAP_PX}
            y={centers[index] ?? placed.y}
            textAnchor={isFirst ? 'end' : 'start'}
            dominantBaseline="middle"
            {...stylex.props(chartStyles.label, chartStyles.haloLabel, styles.transition, !isLit(placed) && styles.dim)}
          >
            <tspan {...stylex.props(chartStyles.strongLabel)}>{shortLabel(placed.node.label)}</tspan>{' '}
            {formatValue(nodeAmount(placed))}
          </text>
        ));
      })}
    </g>
  );
}

import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import { colors, controls, motion, spacing } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { spreadPositions } from '../label-spacing.ts';
import { usePlotWidth } from '../plot-width.ts';
import { plotHeights } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { FLOW_NODE_WIDTH_PX, flowColumns, layoutFlow, ribbonPath, threadPath } from './flow-layout.ts';
import type { FlowLink, FlowNode, PlacedFlowLink, PlacedFlowNode } from './flow-layout.ts';

export type { FlowLink, FlowNode } from './flow-layout.ts';

export type FlowDiagramProps = FigureProps &
  FigureSelectionProps & {
    readonly nodes: ReadonlyArray<FlowNode>;
    readonly links: ReadonlyArray<FlowLink>;
    /** How every amount is written, for labels, inspection and exact values. */
    readonly valueFormat: ValueFormat;
    /** The plot height. Absent fits the busiest column. */
    readonly height?: PlotHeight | undefined;
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
});

/** The render limits. Larger input shows an explicit error; the application supplies a coarser grouping. */
export const flowLimits = { nodes: 64, links: 256 } as const;

const PLOT_PADDING_PX = 8;
const LABEL_GAP_PX = 8;
const LABEL_SPACING_PX = 16;
const CHARACTER_WIDTH_PX = 6.5;
const LABEL_CHARACTERS_MAX = 22;
const GUTTER_MAX_PX = 180;
const ROW_HEIGHT_PX = 48;
const MIN_HEIGHT_PX = 240;
/** The room above the nodes for the labels of middle columns, which sit above their node, clear of the ribbons. */
const MIDDLE_LABEL_PX = 18;
const MIDDLE_LABEL_GAP_PX = 5;

function validateFlow({
  nodes,
  links,
}: {
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
}): string | undefined {
  if (nodes.length > flowLimits.nodes || links.length > flowLimits.links) {
    return `This flow exceeds the render limit of ${flowLimits.nodes} nodes or ${flowLimits.links} links. Supply a smaller, labelled grouping.`;
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

type AmountText = (value: number) => string;

function nodeValueText({
  placed,
  amountText,
}: {
  readonly placed: PlacedFlowNode;
  readonly amountText: AmountText;
}): string {
  const isPassing = placed.inflow > 0 && placed.outflow > 0 && placed.inflow !== placed.outflow;

  const amounts = isPassing
    ? `in ${amountText(placed.inflow)}, out ${amountText(placed.outflow)}`
    : amountText(nodeAmount(placed));

  return placed.hasUnavailable ? `${amounts}, with an unavailable amount` : amounts;
}

function linkText({
  placed,
  amountText,
}: {
  readonly placed: PlacedFlowLink;
  readonly amountText: AmountText;
}): string {
  const amount = placed.link.value === null ? 'Unavailable' : amountText(placed.link.value);

  return `${placed.source.node.label} → ${placed.target.node.label}: ${amount}`;
}

/** The width that one column's outside labels need, as name and amount on one line. */
function labelGutter({
  nodes,
  links,
  amountText,
}: {
  readonly nodes: ReadonlyArray<FlowNode>;
  readonly links: ReadonlyArray<FlowLink>;
  readonly amountText: AmountText;
}): number {
  const characters = nodes.map((node) => {
    const incoming = links
      .filter((link) => link.targetId === node.id)
      .reduce((sum, link) => sum + (link.value ?? 0), 0);

    const outgoing = links
      .filter((link) => link.sourceId === node.id)
      .reduce((sum, link) => sum + (link.value ?? 0), 0);

    const total = Math.max(incoming, outgoing);

    return shortLabel(node.label).length + amountText(total).length + 1;
  });

  return Math.min(GUTTER_MAX_PX, Math.max(0, ...characters) * CHARACTER_WIDTH_PX + LABEL_GAP_PX);
}

/**
 * Shows how supplied amounts divide and move between stages, such as a total splitting into categories and their parts.
 * Node height and ribbon width share one scale; columns follow the links and keep the supplied order. Use BreakdownBar
 * for one level of parts and RelationGraph for unweighted relationships; the diagram never infers or balances a flow.
 */
export function FlowDiagram(props: FlowDiagramProps): ReactNode {
  const { nodes, links, valueFormat, height, selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No flows', ...frame } = figure;
  const { locale, title } = frame;
  const { ref, width } = usePlotWidth();
  const tones = useTones();
  const linked = useLinkedInspection();

  function amountText(value: number): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const issue = validateFlow({ nodes, links });
  const columnOf = (issue === undefined ? flowColumns({ nodes, links }) : undefined) ?? new Map<string, number>();
  const lastColumn = Math.max(0, ...columnOf.values());

  const columnSizes = Array.from(
    { length: lastColumn + 1 },
    (_, column) => nodes.filter((node) => columnOf.get(node.id) === column).length,
  );

  const plotHeight =
    height === undefined ? Math.max(MIN_HEIGHT_PX, Math.max(...columnSizes) * ROW_HEIGHT_PX) : plotHeights[height];

  const firstNodes = lastColumn === 0 ? [] : nodes.filter((node) => columnOf.get(node.id) === 0);
  const lastNodes = nodes.filter((node) => columnOf.get(node.id) === lastColumn);
  const startGutter = labelGutter({ nodes: firstNodes, links, amountText });
  const endGutter = labelGutter({ nodes: lastNodes, links, amountText });

  const top = PLOT_PADDING_PX + (lastColumn > 1 ? MIDDLE_LABEL_PX : 0);

  const layout = layoutFlow({
    nodes: issue === undefined ? nodes : [],
    links: issue === undefined ? links : [],
    left: startGutter,
    right: Math.max(startGutter + FLOW_NODE_WIDTH_PX, width - endGutter),
    top,
    bottom: plotHeight - PLOT_PADDING_PX,
    toneOf: (node, index) => tones({ id: node.id, tone: node.tone, index }),
  });

  const items = layout.nodes.flatMap((placed) => [
    { id: placed.node.id, label: `${placed.node.label}: ${nodeValueText({ placed, amountText })}` },
    ...layout.links
      .filter((link) => link.source.node.id === placed.node.id)
      .map((link) => ({ id: link.link.id, label: linkText({ placed: link, amountText }) })),
  ]);

  const readoutId = useId();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height ?? 'regular'} />;
  }

  if (issue !== undefined) {
    return <FigureInvalid {...frame} message={issue} />;
  }

  return (
    <Chart
      {...linked}
      items={items}
      arrows="both"
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => {
        const activeLink = layout.links.find((placed) => placed.link.id === inspected);
        const activeNode = layout.nodes.find((placed) => placed.node.id === inspected);

        function isLinkLit(placed: PlacedFlowLink): boolean {
          if (activeLink !== undefined) {
            return activeLink.link.id === placed.link.id;
          }

          return (
            activeNode !== undefined && [placed.source.node.id, placed.target.node.id].includes(activeNode.node.id)
          );
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

        const isInspecting = inspected !== null;

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
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
                  values: [placed.node.label, nodeValueText({ placed, amountText })],
                })),
                ...layout.links.map((placed) => ({
                  id: `link:${placed.link.id}`,
                  values: [
                    `${placed.source.node.label} → ${placed.target.node.label}`,
                    placed.link.value === null ? 'Unavailable' : amountText(placed.link.value),
                  ],
                })),
              ]}
            />
            <div ref={ref}>
              {nodes.length === 0 ? (
                <FigureEmpty>{emptyLabel}</FigureEmpty>
              ) : (
                <ChartPlot
                  role="group"
                  aria-label={plotLabel({ title, isSelectable: onSelectedChange !== undefined })}
                  aria-describedby={readoutId}
                  {...stylex.props(styles.surface, stylex.defaultMarker())}
                >
                  <svg
                    aria-hidden
                    viewBox={`0 0 ${width} ${plotHeight}`}
                    height={plotHeight}
                    {...stylex.props(styles.svg)}
                  >
                    <g>
                      {layout.links.map((placed) => {
                        const color = chartToneColors[placed.tone];
                        const isLit = isLinkLit(placed);
                        const hasWidth = placed.width > 0;
                        const isSelected = selected === placed.link.id;
                        const isResting = !isInspecting && !isSelected && cursor === placed.link.id;

                        return (
                          <ChartMark
                            key={placed.link.id}
                            value={placed.link.id}
                            render={<path d={hasWidth ? ribbonPath(placed) : threadPath(placed)} />}
                            {...stylex.props(
                              hasWidth ? styles.ribbon(color) : styles.thread(color),
                              placed.link.value === null && styles.unavailable,
                              styles.transition,
                              isLit && hasWidth && styles.lit,
                              isInspecting && !isLit && styles.dim,
                              isSelected && styles.selected,
                              onSelectedChange !== undefined && styles.interactive,
                              isResting && (hasWidth ? chartStyles.shapeCursor : chartStyles.cursor),
                            )}
                          />
                        );
                      })}
                    </g>
                    {layout.nodes.map((placed) => (
                      <ChartMark
                        key={placed.node.id}
                        value={placed.node.id}
                        render={<rect x={placed.x} y={placed.y} width={FLOW_NODE_WIDTH_PX} height={placed.height} />}
                        {...stylex.props(
                          styles.node(chartToneColors[placed.tone], chartToneOutlines[placed.tone]),
                          styles.transition,
                          isInspecting && !isNodeLit(placed) && styles.dim,
                          selected === placed.node.id && styles.selected,
                          onSelectedChange !== undefined && styles.interactive,
                          !isInspecting && cursor === placed.node.id && chartStyles.cursor,
                        )}
                      />
                    ))}
                    <FlowLabels
                      nodes={layout.nodes}
                      columnCount={layout.columnCount}
                      width={width}
                      top={top}
                      bottom={plotHeight - PLOT_PADDING_PX}
                      amountText={amountText}
                      isLit={(placed) => !isInspecting || isNodeLit(placed)}
                    />
                  </svg>
                </ChartPlot>
              )}
            </div>
          </FigureFrame>
        );
      }}
    />
  );
}

function FlowLabels({
  nodes,
  columnCount,
  width,
  top,
  bottom,
  amountText,
  isLit,
}: {
  readonly nodes: ReadonlyArray<PlacedFlowNode>;
  readonly columnCount: number;
  /** The plot width, so a middle label centered over its node stays inside it. */
  readonly width: number;
  readonly top: number;
  readonly bottom: number;
  readonly amountText: AmountText;
  readonly isLit: (placed: PlacedFlowNode) => boolean;
}): ReactNode {
  const columns = Array.from({ length: columnCount }, (_, column) =>
    nodes.filter((placed) => placed.column === column),
  );

  return (
    <g>
      {columns.map((column, columnIndex) => {
        const isFirst = columnIndex === 0 && columnCount > 1;
        const isMiddle = columnIndex > 0 && columnIndex < columnCount - 1;

        const centers = spreadPositions({
          positions: column.map((placed) => placed.y + placed.height / 2),
          gap: LABEL_SPACING_PX,
          start: top,
          end: bottom,
        });

        return column.map((placed, index) => {
          const name = shortLabel(placed.node.label);
          const amount = amountText(nodeAmount(placed));
          const half = ((name.length + amount.length + 1) * CHARACTER_WIDTH_PX) / 2;
          const side = isFirst ? placed.x - LABEL_GAP_PX : placed.x + FLOW_NODE_WIDTH_PX + LABEL_GAP_PX;
          const over = Math.min(width - half, Math.max(half, placed.x + FLOW_NODE_WIDTH_PX / 2));

          return (
            <text
              key={placed.node.id}
              x={isMiddle ? over : side}
              y={isMiddle ? placed.y - MIDDLE_LABEL_GAP_PX : (centers[index] ?? placed.y)}
              textAnchor={isMiddle ? 'middle' : isFirst ? 'end' : 'start'}
              dominantBaseline={isMiddle ? 'auto' : 'middle'}
              {...stylex.props(
                chartStyles.label,
                chartStyles.haloLabel,
                styles.transition,
                !isLit(placed) && styles.dim,
              )}
            >
              <tspan {...stylex.props(chartStyles.strongLabel)}>{name}</tspan> {amount}
            </text>
          );
        });
      })}
    </g>
  );
}

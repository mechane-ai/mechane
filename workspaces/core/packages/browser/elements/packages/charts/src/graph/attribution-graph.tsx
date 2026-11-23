import * as stylex from '@stylexjs/stylex';
import type { ChangeDetails, ChangeSource } from '@ui-sdk/core';
import { useId, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Button, TextButton } from '../../../core/src/index.ts';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { ChartSeriesMarker } from '../chart-series-marker.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, inspectedLabel } from '../chart.tsx';
import type { ChartView } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { LabelMark, LinkMark, SymbolMark } from '../plot/plot-marks.tsx';
import type { MarkEmphasis, SymbolShape } from '../plot/plot-marks.tsx';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { attributionGeometry, attributionLayout, edgeWidth } from './attribution-layout.ts';
import type { AttributionDirection, PlacedAttributionNode } from './attribution-layout.ts';
import { fitLabel, GraphCanvas, GraphCursor } from './graph-canvas.tsx';

export type { AttributionDirection } from './attribution-layout.ts';

/** One layer of the model, in the order computation flows: input tokens, the layers, then the output logits. */
export type AttributionLayer = { readonly id: string; readonly label: string };

/** What a node stands for, by shape. An error node is hollow, the part the features leave unexplained. */
export type AttributionNodeKind = 'token' | 'feature' | 'error' | 'output';

export type AttributionNode = {
  readonly id: string;
  readonly layerId: string;
  readonly label: string;
  /** A longer description for the readout, such as the feature's top activating contexts. */
  readonly detail?: string | undefined;
  /** The node's own measure, such as an activation, in `valueFormat`. Null where none was recorded. */
  readonly value?: number | null | undefined;
  readonly kind?: AttributionNodeKind | undefined;
};

/** A supplied, signed attribution from an earlier node to a later one. */
export type AttributionEdge = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly weight: number;
};

/** Why the pinned nodes changed: the visible Pin control, or the P key on the plot. */
export type AttributionPinReason = 'item-press' | 'shortcut';
export type AttributionPinDetails = ChangeDetails<AttributionPinReason>;

export type AttributionGraphProps = FigureProps &
  FigureSelectionProps & {
    readonly layers: ReadonlyArray<AttributionLayer>;
    /** Nodes in the order the application wants them within each layer. The graph never reorders them. */
    readonly nodes: ReadonlyArray<AttributionNode>;
    readonly edges: ReadonlyArray<AttributionEdge>;
    /** What an edge weight measures, such as "Attribution". */
    readonly weightLabel: string;
    readonly weightFormat: ValueFormat;
    /** What a node value measures, such as "Activation". Required when any node has a value. */
    readonly valueLabel?: string | undefined;
    readonly valueFormat?: ValueFormat | undefined;
    /** Which way layers advance. Defaults to bottom to top, with the inputs at the bottom. */
    readonly direction?: AttributionDirection | undefined;
    /** The nodes a reader has pinned to build a subgraph. Leave it out and the graph keeps its own pins. */
    readonly pinned?: ReadonlyArray<string> | undefined;
    readonly onPinnedChange?: ((ids: ReadonlyArray<string>, details: AttributionPinDetails) => void) | undefined;
  };

export const attributionLimits = { nodes: 400, edges: 2000, layers: 40 } as const;

const STRONGEST_COUNT = 3;
const CURSOR_GAP = 6;
const PIN_GAP = 3.5;
const HIT_RADIUS = 14;
const LABEL_RISE = 5;
const BASELINE = 4;
const LEGEND_ICON = 16;
const LEGEND_LINE = 18;
const LEGEND_RADIUS = 5;
const WIDTH_SAMPLES = [1, 0.5, 0.25] as const;
const NO_TEXT = ' ';
const HINT = 'Point at a node, or focus the graph and use the arrow keys. Press P to pin the node you inspect.';
const CONTROLS = '[data-attribution-controls]';
const pinKeys: ReadonlySet<string> = new Set(['p', 'P']);
const hollowKinds: ReadonlySet<AttributionNodeKind> = new Set(['error']);

const kindShapes: Readonly<Record<AttributionNodeKind, SymbolShape>> = {
  token: 'square',
  feature: 'circle',
  error: 'circle',
  output: 'diamond',
};

const kindNames: Readonly<Record<AttributionNodeKind, string>> = {
  token: 'Token',
  feature: 'Feature',
  error: 'Error (unexplained)',
  output: 'Output',
};

const kindOrder: ReadonlyArray<AttributionNodeKind> = ['token', 'feature', 'error', 'output'];

const styles = stylex.create({
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: `${spacing.xs} ${spacing.md}`,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
  },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, whiteSpace: 'nowrap' },
  widthSample: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, marginInlineStart: spacing.xs },
  icon: { display: 'block', overflow: 'visible' },
  band: { fill: colors.canvas, stroke: 'none' },
  layerLabel: { fill: colors.muted },
  pin: { fill: 'none', stroke: colors.ink, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' },
  hit: { fill: 'transparent', cursor: 'pointer' },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 0,
  },
  readout: {
    display: 'grid',
    flex: '1 1 18rem',
    minWidth: 0,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  readoutLine: { margin: 0, minHeight: typography.captionLineHeight },
  heading: { fontWeight: typography.mediumWeight, whiteSpace: 'pre-wrap' },
  hint: { color: colors.muted },
  exact: { whiteSpace: 'pre' },
  controls: { display: 'flex', flexWrap: 'wrap', gap: spacing.xs },
});

/** Labels fade with the marks they name. */
const labelEmphasis = stylex.create({ normal: {}, context: {}, receded: { opacity: 0.32 } });

function signTone(weight: number): ChartTone {
  if (weight > 0) {
    return 'positive';
  }

  return weight < 0 ? 'negative' : 'neutral';
}

/** A weight with its sign always written, so a reader never infers the sign from hue alone. */
function signedFormat(format: ValueFormat): ValueFormat {
  return typeof format === 'function' ? format : { signDisplay: 'exceptZero', ...format };
}

function attributionInputError({
  layers,
  nodes,
  edges,
  pinned,
  valueFormat,
  valueLabel,
}: Pick<AttributionGraphProps, 'layers' | 'nodes' | 'edges' | 'valueFormat' | 'valueLabel'> & {
  readonly pinned: ReadonlyArray<string> | undefined;
}): string | undefined {
  const limits = attributionLimits;

  if (layers.length > limits.layers || nodes.length > limits.nodes || edges.length > limits.edges) {
    return `This graph draws at most ${limits.layers} layers, ${limits.nodes} nodes and ${limits.edges} edges. Supply a pruned graph.`;
  }

  if (!hasUniqueIds(layers) || !hasUniqueIds(nodes) || !hasUniqueIds(edges)) {
    return 'Layers, nodes and edges must each have unique identifiers.';
  }

  const layerIndex = new Map(layers.map((layer, index) => [layer.id, index]));
  const stray = nodes.find((node) => !layerIndex.has(node.layerId));

  if (stray !== undefined) {
    return `Node ${stray.id} names layer ${stray.layerId}, which is not supplied.`;
  }

  const unmeasured = nodes.find((node) => typeof node.value === 'number' && !Number.isFinite(node.value));

  if (unmeasured !== undefined) {
    return `Node ${unmeasured.id} has a value that is not finite. Use null for a value that was not recorded.`;
  }

  const hasValues = nodes.some((node) => typeof node.value === 'number');

  if (hasValues && (valueFormat === undefined || valueLabel === undefined)) {
    return 'Nodes carry values, so the graph needs a valueLabel and a valueFormat to state them.';
  }

  const nodeLayer = new Map(nodes.map((node) => [node.id, layerIndex.get(node.layerId) ?? 0]));

  for (const edge of edges) {
    const source = nodeLayer.get(edge.sourceId);
    const target = nodeLayer.get(edge.targetId);

    if (source === undefined || target === undefined) {
      return `Edge ${edge.id} names a node that is not supplied.`;
    }

    if (edge.sourceId === edge.targetId) {
      return `Edge ${edge.id} joins a node to itself.`;
    }

    if (target <= source) {
      return `Edge ${edge.id} does not advance through the layers. Every edge must run from an earlier layer to a later one.`;
    }

    if (!Number.isFinite(edge.weight)) {
      return `Edge ${edge.id} has a weight that is not finite.`;
    }
  }

  const pins = pinned ?? [];

  if (new Set(pins).size !== pins.length || pins.some((id) => !nodeLayer.has(id))) {
    return 'Pinned nodes must be unique and name supplied nodes.';
  }

  return undefined;
}

function pinDetails(
  given:
    | { readonly reason: 'item-press'; readonly event: MouseEvent }
    | { readonly reason: 'shortcut'; readonly event: KeyboardEvent },
  source: ChangeSource,
): AttributionPinDetails {
  const state = { isCanceled: false };

  function cancel(): void {
    state.isCanceled = true;
  }

  const shared = {
    source,
    cancel,
    get canceled() {
      return state.isCanceled;
    },
  };

  return given.reason === 'shortcut'
    ? { ...shared, reason: given.reason, event: given.event }
    : { ...shared, reason: given.reason, event: given.event };
}

function KindIcon({ kind }: { readonly kind: AttributionNodeKind }): ReactNode {
  const middle = LEGEND_ICON / 2;

  return (
    <svg width={LEGEND_ICON} height={LEGEND_ICON} aria-hidden {...stylex.props(styles.icon)}>
      <SymbolMark
        shape={kindShapes[kind]}
        x={middle}
        y={middle}
        radius={LEGEND_RADIUS}
        tone="neutral"
        isHollow={hollowKinds.has(kind)}
      />
    </svg>
  );
}

/** What the edge widths mean: three sample widths with the weights they stand for. */
function WidthLegend({
  weightLabel,
  weightMax,
  weightText,
}: {
  readonly weightLabel: string;
  readonly weightMax: number;
  readonly weightText: (value: number) => string;
}): ReactNode {
  const middle = LEGEND_ICON / 2;

  return (
    <ul aria-label={`Width: ${weightLabel}`} {...stylex.props(styles.legend)}>
      <li {...stylex.props(styles.legendItem)}>
        {`Width: absolute ${weightLabel.toLowerCase()}`}
        {WIDTH_SAMPLES.map((share) => (
          <span key={share} {...stylex.props(styles.widthSample)}>
            <svg width={LEGEND_LINE} height={LEGEND_ICON} aria-hidden {...stylex.props(styles.icon)}>
              <LinkMark
                d={`M1,${middle}H${LEGEND_LINE - 1}`}
                tone="neutral"
                width={edgeWidth({ weight: weightMax * share, weightMax })}
              />
            </svg>
            {weightText(weightMax * share)}
          </span>
        ))}
      </li>
    </ul>
  );
}

/** What the hues and shapes name: the sign of an edge, each kind of node, and the pinned ring. */
function AttributionLegend({
  kinds,
  weightLabel,
}: {
  readonly kinds: ReadonlyArray<AttributionNodeKind>;
  readonly weightLabel: string;
}): ReactNode {
  const middle = LEGEND_ICON / 2;

  return (
    <ul aria-label="Legend" {...stylex.props(styles.legend)}>
      <li {...stylex.props(styles.legendItem)}>
        <ChartSeriesMarker tone="positive" shape="line" />
        {`${weightLabel} above zero`}
      </li>
      <li {...stylex.props(styles.legendItem)}>
        <ChartSeriesMarker tone="negative" shape="line" />
        {`${weightLabel} below zero`}
      </li>
      {kinds.map((kind) => (
        <li key={kind} {...stylex.props(styles.legendItem)}>
          <KindIcon kind={kind} />
          {kindNames[kind]}
        </li>
      ))}
      <li {...stylex.props(styles.legendItem)}>
        <svg width={LEGEND_ICON} height={LEGEND_ICON} aria-hidden {...stylex.props(styles.icon)}>
          <circle cx={middle} cy={middle} r={LEGEND_RADIUS + 1} {...stylex.props(styles.pin)} />
        </svg>
        Pinned
      </li>
    </ul>
  );
}

function NodeLabel({
  label,
  placed,
  isUp,
}: {
  readonly label: string;
  readonly placed: PlacedAttributionNode;
  readonly isUp: boolean;
}): ReactNode {
  const radius = attributionGeometry.nodeRadius;

  return isUp ? (
    <LabelMark x={placed.x + radius + attributionGeometry.labelGap} y={placed.y + BASELINE}>
      {label}
    </LabelMark>
  ) : (
    <LabelMark x={placed.x} y={placed.y - radius - LABEL_RISE} anchor="middle">
      {label}
    </LabelMark>
  );
}

type NodeSummary = { readonly heading: string; readonly inputs: string; readonly outputs: string };

/**
 * An attribution graph: how a model computes an output, traced through input tokens, features in each layer and the
 * output logits, with only supplied edges drawn. Nodes sit in supplied order within each layer, and edges carry
 * supplied signed attributions, with hue giving the sign and width the size. Inspect a node to light its inputs and
 * outputs, and pin nodes to keep their mutual edges in view.
 */
export function AttributionGraph(props: AttributionGraphProps): ReactNode {
  const {
    layers,
    nodes,
    edges,
    weightLabel,
    weightFormat,
    valueLabel,
    valueFormat,
    direction = 'up',
    pinned,
    onPinnedChange,
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No attribution graph is available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize('tall');
  const readoutId = useId();
  const link = useLinkedInspection();
  const [ownPinned, setOwnPinned] = useState<ReadonlyArray<string>>([]);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height="tall" />;
  }

  const inputError = attributionInputError({ layers, nodes, edges, pinned, valueFormat, valueLabel });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const layout = attributionLayout({ layers, nodes, edges, direction, width: size.width });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const pins = pinned ?? ownPinned;
  const pinSet = new Set(pins);
  const isUp = direction === 'up';
  const radius = attributionGeometry.nodeRadius;

  function weightText(value: number): string {
    return formatValue({ value, locale, format: signedFormat(weightFormat) });
  }

  function magnitudeText(value: number): string {
    return formatValue({ value, locale, format: weightFormat });
  }

  function strongest(list: ReadonlyArray<{ readonly id: string; readonly weight: number }>): string {
    return list
      .toSorted((first, second) => Math.abs(second.weight) - Math.abs(first.weight))
      .slice(0, STRONGEST_COUNT)
      .map((entry) => `${nodeById.get(entry.id)?.label ?? entry.id} ${weightText(entry.weight)}`)
      .join(', ');
  }

  function summary(node: AttributionNode): NodeSummary {
    const kind = node.kind ?? 'feature';
    const layer = layerById.get(node.layerId)?.label ?? node.layerId;
    const hasValue = node.value !== undefined && valueLabel !== undefined && valueFormat !== undefined;

    const value = hasValue
      ? `${valueLabel} ${formatValue({ value: node.value ?? null, locale, format: valueFormat })}`
      : undefined;

    const incoming = edges
      .filter((edge) => edge.targetId === node.id)
      .map((edge) => ({ id: edge.sourceId, weight: edge.weight }));

    const outgoing = edges
      .filter((edge) => edge.sourceId === node.id)
      .map((edge) => ({ id: edge.targetId, weight: edge.weight }));

    return {
      heading: [node.label, kindNames[kind], layer, value, node.detail]
        .filter((part) => part !== undefined)
        .join(' · '),
      inputs: incoming.length === 0 ? 'No inputs' : `Strongest inputs: ${strongest(incoming)}`,
      outputs: outgoing.length === 0 ? 'No outputs' : `Strongest outputs: ${strongest(outgoing)}`,
    };
  }

  const ordered = layers.flatMap((layer) => nodes.filter((node) => node.layerId === layer.id));
  const summaries = new Map(ordered.map((node) => [node.id, summary(node)]));

  const items = ordered.map((node) => {
    const text = summaries.get(node.id);

    return {
      id: node.id,
      label: text === undefined ? node.label : [text.heading, text.inputs, text.outputs].join('. '),
    };
  });

  const kinds = kindOrder.filter((kind) => nodes.some((node) => (node.kind ?? 'feature') === kind));

  function changePins(next: ReadonlyArray<string>, details: AttributionPinDetails): void {
    onPinnedChange?.(next, details);

    if (pinned === undefined && !details.canceled) {
      setOwnPinned(next);
    }
  }

  function toggled(id: string): ReadonlyArray<string> {
    return pinSet.has(id) ? pins.filter((pin) => pin !== id) : [...pins, id];
  }

  function place(id: string): { left: number; top: number; right: number; bottom: number } | undefined {
    const node = layout.nodes.get(id);

    return node === undefined
      ? undefined
      : { left: node.x - radius, top: node.y - radius, right: node.x + radius, bottom: node.y + radius };
  }

  function renderGraph(view: ChartView): ReactNode {
    const { inspected, cursor } = view;
    const hasPinnedEdges = edges.some((edge) => pinSet.has(edge.sourceId) && pinSet.has(edge.targetId));
    const isFocusing = inspected !== null || hasPinnedEdges;

    function isLit(edge: AttributionEdge): boolean {
      const touchesInspected = inspected !== null && (edge.sourceId === inspected || edge.targetId === inspected);

      return touchesInspected || (pinSet.has(edge.sourceId) && pinSet.has(edge.targetId));
    }

    const litEdges = new Set(edges.filter(isLit).map((edge) => edge.id));

    const litNodes = new Set([
      ...pins,
      ...(inspected === null ? [] : [inspected]),
      ...edges.flatMap((edge) => (litEdges.has(edge.id) ? [edge.sourceId, edge.targetId] : [])),
    ]);

    const drawnEdges = layout.edges.toSorted(
      (first, second) => Number(litEdges.has(first.id)) - Number(litEdges.has(second.id)),
    );

    const cursorNode = cursor === null ? undefined : layout.nodes.get(cursor);

    function nodeEmphasis(id: string): MarkEmphasis {
      return isFocusing && !litNodes.has(id) ? 'receded' : 'normal';
    }

    return (
      <GraphCanvas
        plotRef={size.ref}
        title={title}
        marks="nodes"
        readoutId={readoutId}
        isSelectable={onSelectedChange !== undefined}
        width={layout.width}
        height={layout.height}
        cursor={cursorNode}
        onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
          const target = inspected ?? cursor;
          const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

          if (!pinKeys.has(event.key) || hasModifier || target === null) {
            return;
          }

          event.preventDefault();
          changePins(toggled(target), pinDetails({ reason: 'shortcut', event: event.nativeEvent }, 'keyboard'));
        }}
      >
        {layout.layers.map((layer, index) =>
          index % 2 === 1 ? (
            <rect
              key={layer.id}
              x={isUp ? 0 : layer.start}
              y={isUp ? layer.start : 0}
              width={isUp ? layout.width : layer.end - layer.start}
              height={isUp ? layer.end - layer.start : layout.height}
              {...stylex.props(styles.band)}
            />
          ) : null,
        )}
        {layout.layers.map((layer) => (
          <text
            key={layer.id}
            x={layer.labelX}
            y={layer.labelY + BASELINE}
            textAnchor={isUp ? 'start' : 'middle'}
            {...stylex.props(chartStyles.label, chartStyles.tick, styles.layerLabel)}
          >
            {isUp ? layer.label : fitLabel(layer.label, layer.end - layer.start)}
          </text>
        ))}
        {drawnEdges.map((placed) => {
          const edge = edges.find((candidate) => candidate.id === placed.id);

          return edge === undefined ? null : (
            <LinkMark
              key={placed.id}
              d={placed.d}
              tone={signTone(edge.weight)}
              width={placed.width}
              emphasis={isFocusing && !litEdges.has(placed.id) ? 'receded' : 'normal'}
            />
          );
        })}
        {ordered.map((node) => {
          const placed = layout.nodes.get(node.id);

          if (placed === undefined) {
            return null;
          }

          const kind = node.kind ?? 'feature';
          const emphasis = nodeEmphasis(node.id);

          return (
            <ChartMark key={node.id} value={node.id} render={<g />}>
              {pinSet.has(node.id) && (
                <circle cx={placed.x} cy={placed.y} r={radius + PIN_GAP} {...stylex.props(styles.pin)} />
              )}
              <SymbolMark
                shape={kindShapes[kind]}
                x={placed.x}
                y={placed.y}
                radius={radius}
                tone="neutral"
                isHollow={hollowKinds.has(kind)}
                emphasis={emphasis}
                isInspected={inspected === node.id}
                isSelected={selected === node.id}
              />
              <g {...stylex.props(chartStyles.emphasis, labelEmphasis[emphasis], styles.exact)}>
                <NodeLabel label={fitLabel(node.label, layout.labelWidth)} placed={placed} isUp={isUp} />
              </g>
              <circle cx={placed.x} cy={placed.y} r={HIT_RADIUS} {...stylex.props(styles.hit)} />
            </ChartMark>
          );
        })}
        {cursorNode !== undefined && <GraphCursor x={cursorNode.x} y={cursorNode.y} radius={radius + CURSOR_GAP} />}
      </GraphCanvas>
    );
  }

  return (
    <Chart
      {...link}
      items={items}
      place={place}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      within={(target) => target instanceof Element && target.closest(CONTROLS) !== null}
      render={(figureProps, view) => {
        const isSelectedKnown = selected !== undefined && selected !== null && nodeById.has(selected);
        const target = view.inspected ?? (isSelectedKnown ? selected : null);

        const text = view.inspected === null ? undefined : summaries.get(view.inspected);
        const targetLabel = target === null ? undefined : nodeById.get(target)?.label;
        const isPinned = target !== null && pinSet.has(target);

        const footer =
          nodes.length === 0 ? undefined : (
            <div {...stylex.props(styles.footer)}>
              <span id={readoutId} {...stylex.props(accessibility.hidden)}>
                {inspectedLabel(items, view.inspected)}
              </span>
              <div aria-hidden {...stylex.props(styles.readout)}>
                {text === undefined ? (
                  <p {...stylex.props(styles.readoutLine, styles.hint)}>{HINT}</p>
                ) : (
                  <p {...stylex.props(styles.readoutLine, styles.heading)}>{text.heading}</p>
                )}
                <p {...stylex.props(styles.readoutLine)}>{text?.inputs ?? NO_TEXT}</p>
                <p {...stylex.props(styles.readoutLine)}>{text?.outputs ?? NO_TEXT}</p>
              </div>
              <div data-attribution-controls="" {...stylex.props(styles.controls)}>
                <Button
                  variant="outline"
                  density="compact"
                  disabled={target === null}
                  aria-label={targetLabel === undefined ? 'Pin a node' : `${isPinned ? 'Unpin' : 'Pin'} ${targetLabel}`}
                  onClick={(event, { source }) => {
                    if (target !== null) {
                      changePins(
                        toggled(target),
                        pinDetails({ reason: 'item-press', event: event.nativeEvent }, source),
                      );
                    }
                  }}
                >
                  {isPinned ? 'Unpin' : 'Pin'}
                </Button>
                {pins.length > 0 && (
                  <TextButton
                    density="compact"
                    onClick={(event, { source }) =>
                      changePins([], pinDetails({ reason: 'item-press', event: event.nativeEvent }, source))
                    }
                  >
                    {`Clear ${pins.length} pinned`}
                  </TextButton>
                )}
              </div>
            </div>
          );

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            seriesLegend={
              nodes.length === 0 ? undefined : <AttributionLegend kinds={kinds} weightLabel={weightLabel} />
            }
            scaleLegend={
              nodes.length === 0 || layout.weightMax === 0 ? undefined : (
                <WidthLegend weightLabel={weightLabel} weightMax={layout.weightMax} weightText={magnitudeText} />
              )
            }
            footer={footer}
          >
            {nodes.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                {renderGraph(view)}
                <ChartData
                  label={`${title} nodes and edges`}
                  columns={[
                    { id: 'record', label: 'Record' },
                    { id: 'detail', label: 'Detail' },
                  ]}
                  rows={[
                    ...items.map((item) => ({
                      id: `node:${item.id}`,
                      values: [nodeById.get(item.id)?.label ?? item.id, item.label],
                    })),
                    ...edges.map((edge) => ({
                      id: `edge:${edge.id}`,
                      values: [
                        `${nodeById.get(edge.sourceId)?.label ?? edge.sourceId} → ${nodeById.get(edge.targetId)?.label ?? edge.targetId}`,
                        `${weightLabel} ${weightText(edge.weight)}`,
                      ],
                    })),
                  ]}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}

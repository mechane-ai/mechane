import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue, MISSING_VALUE_TEXT } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { plotBox } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { AreaMark } from './area-mark.tsx';
import { cellAt, partitionLayout } from './partition-layout.ts';
import type { PartitionInput } from './partition-layout.ts';

/** One node of a hierarchy, listed flat. The root has a null parent. */
export type IcicleNode = {
  readonly id: string;
  readonly parentId: string | null;
  readonly label: string;
  /**
   * The application's total for this node, including its descendants, or null where none was recorded. A parent may
   * exceed the sum of its children; the rest of its width stays empty. A node without a value, and everything under it,
   * has no area.
   */
  readonly value: number | null;
  /** The node's hue. Absent, each child of the root takes the next series hue and its descendants share it. */
  readonly tone?: ChartTone | undefined;
};

export type IcicleProps = FigureProps &
  FigureSelectionProps & {
    readonly nodes: ReadonlyArray<IcicleNode>;
    readonly valueFormat: ValueFormat;
    readonly height?: PlotHeight | undefined;
  };

/** The most nodes and levels below the root one icicle draws. Supply a coarser hierarchy for more. */
export const icicleLimits = { nodes: 500, depth: 8 } as const;

const styles = stylex.create({
  note: { color: colors.muted, margin: 0, marginBlockStart: spacing.sm, fontSize: typography.captionSize },
});

const shareFormat = { style: 'percent', maximumFractionDigits: 1 } as const;
const LABEL_WIDTH = 48;
const PATH_SEPARATOR = ' › ';

function depthOf(nodes: ReadonlyArray<IcicleNode>, node: IcicleNode, seen: ReadonlySet<string>): number | undefined {
  if (node.parentId === null) {
    return 0;
  }

  const parent = nodes.find((candidate) => candidate.id === node.parentId);

  if (parent === undefined || seen.has(parent.id)) {
    return undefined;
  }

  const above = depthOf(nodes, parent, new Set([...seen, node.id]));

  return above === undefined ? undefined : above + 1;
}

function icicleError(nodes: ReadonlyArray<IcicleNode>): string | undefined {
  if (nodes.length > icicleLimits.nodes) {
    return `This chart draws at most ${icicleLimits.nodes} nodes. Supply a coarser hierarchy.`;
  }

  if (!hasUniqueIds(nodes)) {
    return 'Hierarchy nodes must have unique identifiers.';
  }

  if (nodes.filter((node) => node.parentId === null).length !== 1) {
    return 'A hierarchy needs exactly one root node with a null parent.';
  }

  const depths = nodes.map((node) => depthOf(nodes, node, new Set([node.id])));

  if (depths.includes(undefined)) {
    return 'Every node must name a supplied parent, and the parents must not form a cycle.';
  }

  if (depths.some((depth) => depth !== undefined && depth > icicleLimits.depth)) {
    return `This chart draws at most ${icicleLimits.depth} levels below the root.`;
  }

  if (nodes.some((node) => node.value !== null && (!Number.isFinite(node.value) || node.value < 0))) {
    return 'Node values must be finite and nonnegative, or explicitly missing.';
  }

  const short = nodes.find((node) => {
    const children = nodes.filter((child) => child.parentId === node.id);
    const known = children.reduce((total, child) => total + (child.value ?? 0), 0);

    return node.value !== null && known > node.value * (1 + Number.EPSILON * children.length);
  });

  return short === undefined
    ? undefined
    : `${short.label} is less than the sum of its children. Supply each node's own total.`;
}

/**
 * A hierarchy as stacked horizontal bands, one row per level, where each node's width is its share of its parent:
 * parameters by module, or time by stage. The application supplies every node's total; a parent larger than its
 * children leaves the rest empty, and the chart never infers a value.
 */
export function Icicle({
  nodes,
  valueFormat,
  selected,
  onSelectedChange,
  height = 'regular',
  ...figure
}: IcicleProps): ReactNode {
  const { emptyLabel = 'No hierarchy was supplied.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const tones = useTones();
  const link = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const inputError = nodes.length === 0 ? undefined : icicleError(nodes);

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));

  function ancestors(node: IcicleNode): ReadonlyArray<IcicleNode> {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId);

    return parent === undefined ? [] : [...ancestors(parent), parent];
  }

  const root = nodes.find((node) => node.parentId === null);
  const branches = nodes.filter((node) => node.parentId === root?.id);

  function toneOf(node: IcicleNode): ChartTone {
    const branch = [...ancestors(node), node].find((candidate) => candidate.parentId === root?.id);
    const index = branch === undefined ? -1 : branches.indexOf(branch);
    const own = [node, ...ancestors(node).toReversed()].find((candidate) => candidate.tone !== undefined)?.tone;

    if (own !== undefined || branch === undefined) {
      return own ?? 'neutral';
    }

    return tones({ id: branch.id, tone: branch.tone, index });
  }

  const sized: ReadonlyArray<PartitionInput> = nodes.flatMap((node) => {
    const isKnown = [node, ...ancestors(node)].every((candidate) => candidate.value !== null);

    return isKnown && node.value !== null ? [{ id: node.id, parentId: node.parentId, value: node.value }] : [];
  });

  const box = plotBox({ width: size.width, height: size.height, margins: { top: 0, right: 0, bottom: 0, left: 0 } });
  const cells = partitionLayout({ nodes: sized, width: box.width, height: box.height });

  function valueText(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  function sentence(node: IcicleNode): string {
    const path = ancestors(node).map((item) => item.label);
    const place = path.length === 0 ? '' : ` (${path.join(PATH_SEPARATOR)})`;
    const rootValue = root?.value ?? null;
    const hasRootValue = rootValue !== null && rootValue > 0;
    const hasShare = node.value !== null && hasRootValue && node !== root;

    const share = hasShare
      ? `, ${formatValue({ value: node.value / rootValue, locale, format: shareFormat })} of ${root?.label ?? ''}`
      : '';

    return `${node.label}${place}: ${valueText(node.value)}${share}`;
  }

  const drawn = cells.flatMap((cell) => {
    const node = byId.get(cell.id);

    return node === undefined ? [] : [{ cell, node, tone: toneOf(node), label: sentence(node) }];
  });

  const items = drawn.map((item) => ({ id: item.node.id, label: item.label }));

  const places = new Map(
    drawn.map(({ cell }) => [cell.id, { left: cell.x0, top: cell.y0, right: cell.x1, bottom: cell.y1 }]),
  );

  const unsized = nodes.length - sized.length;

  return (
    <Chart
      {...link}
      items={items}
      place={(id) => places.get(id)}
      locate={(point) => cellAt(cells, (point.x / point.width) * box.width, (point.y / point.height) * box.height)?.id}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
        >
          {nodes.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <PlotSurface
                plotRef={size.ref}
                box={box}
                label={plotLabel({ title, marks: 'nodes', isSelectable: onSelectedChange !== undefined })}
                readoutId={readoutId}
              >
                {drawn.map(({ cell, node, tone }) => (
                  <AreaMark
                    key={node.id}
                    cell={cell}
                    tone={tone}
                    label={node.label}
                    valueLabel={valueText(node.value)}
                    labelWidth={LABEL_WIDTH}
                    isInspected={inspected === node.id}
                    isSelected={selected === node.id}
                    isCursor={cursor === node.id}
                  />
                ))}
              </PlotSurface>
              {unsized > 0 && (
                <p {...stylex.props(styles.note)}>
                  {unsized === 1 ? 'One node has' : `${unsized} nodes have`} no area: its value or a parent's value is{' '}
                  {MISSING_VALUE_TEXT.toLowerCase()}.
                </p>
              )}
              <ChartData
                label={`${title} nodes`}
                columns={[
                  { id: 'node', label: 'Node' },
                  { id: 'parent', label: 'Parent' },
                  { id: 'value', label: 'Value' },
                ]}
                rows={nodes.map((node) => ({
                  id: node.id,
                  values: [
                    node.label,
                    node.parentId === null ? '' : (byId.get(node.parentId)?.label ?? ''),
                    sentence(node),
                  ],
                }))}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}

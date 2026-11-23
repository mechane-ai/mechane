import { useId } from 'react';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import type { ChartLegendItem } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { Chart, ChartMark, inspectedLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import type { LinkShape } from '../plot/path.ts';
import { DotMark, LabelMark, LinkMark } from '../plot/plot-marks.tsx';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { fitLabel, GraphCanvas, GraphCursor } from './graph-canvas.tsx';
import { treeLayout, treeStructure } from './tree-layout.ts';
import type { PlacedTreeNode, TreeDirection, TreeLeafLabels } from './tree-layout.ts';

export type { TreeDirection } from './tree-layout.ts';

export type TreeNode = {
  readonly id: string;
  /** The parent's id, or null for the one root. */
  readonly parentId: string | null;
  readonly label: string;
  readonly detail?: string | undefined;
  /** The node's measure in `valueFormat`, such as a sample count or a split's impurity. Null if none was recorded. */
  readonly value?: number | null | undefined;
  /** A hue for a class or a group, named in `toneLegend`. Absent draws the node in neutral ink. */
  readonly tone?: ChartTone | undefined;
};

export type TreeDiagramProps = FigureProps &
  FigureSelectionProps & {
    /** Every node once, children after or before their parent, siblings in the order they should be drawn. */
    readonly nodes: ReadonlyArray<TreeNode>;
    readonly direction?: TreeDirection | undefined;
    /** Right-angled elbows, the default, or smooth curves. */
    readonly link?: LinkShape | undefined;
    /** What a node value measures, such as "Samples". Required when any node has a value. */
    readonly valueLabel?: string | undefined;
    readonly valueFormat?: ValueFormat | undefined;
    /** What each node tone means, when nodes carry tones. */
    readonly toneLegend?: ReadonlyArray<ChartLegendItem> | undefined;
  };

export const treeLimits = { nodes: 300, depth: 12 } as const;

const PATH_SEPARATOR = ' › ';
const DOT_RADIUS = 4;
const CURSOR_RADIUS = 9;
const HIT_RADIUS = 13;
const LABEL_GAP = 8;
const LABEL_RISE = 7;
const LABEL_DROP = 18;
const BASELINE = 4;
const QUARTER_TURN = 90;

function treeInputError({
  nodes,
  valueFormat,
  valueLabel,
}: Pick<TreeDiagramProps, 'nodes' | 'valueFormat' | 'valueLabel'>): string | undefined {
  if (nodes.length > treeLimits.nodes) {
    return `This tree draws at most ${treeLimits.nodes} nodes. Supply a cut of the hierarchy.`;
  }

  if (!hasUniqueIds(nodes)) {
    return 'Tree nodes must have unique identifiers.';
  }

  const unmeasured = nodes.find((node) => typeof node.value === 'number' && !Number.isFinite(node.value));

  if (unmeasured !== undefined) {
    return `Node ${unmeasured.id} has a value that is not finite. Use null for a value that was not recorded.`;
  }

  const hasValues = nodes.some((node) => typeof node.value === 'number');

  return hasValues && (valueFormat === undefined || valueLabel === undefined)
    ? 'Nodes carry values, so the tree needs a valueLabel and a valueFormat to state them.'
    : undefined;
}

function TreeLabel({
  label,
  placed,
  leafLabels,
}: {
  readonly label: string;
  readonly placed: PlacedTreeNode;
  readonly leafLabels: TreeLeafLabels;
}): ReactNode {
  const text = fitLabel(label, placed.labelWidth);

  if (!placed.isLeaf) {
    return (
      <LabelMark x={placed.x + LABEL_GAP} y={placed.y + (leafLabels === 'beside' ? BASELINE : -LABEL_RISE)}>
        {text}
      </LabelMark>
    );
  }

  switch (leafLabels) {
    case 'beside':
      return (
        <LabelMark x={placed.x + LABEL_GAP} y={placed.y + BASELINE}>
          {text}
        </LabelMark>
      );
    case 'below':
      return (
        <LabelMark x={placed.x} y={placed.y + LABEL_DROP} anchor="middle">
          {text}
        </LabelMark>
      );
    case 'turned':
      return (
        <g transform={`rotate(${QUARTER_TURN} ${placed.x} ${placed.y})`}>
          <LabelMark x={placed.x + LABEL_GAP} y={placed.y + BASELINE}>
            {text}
          </LabelMark>
        </g>
      );
  }
}

/**
 * A hierarchy drawn as a node-link tree: a decision tree, a module tree or a cut of a cluster dendrogram. Depth runs
 * along one axis and leaves sit evenly in supplied order along the other, and inspecting a node gives its path from the
 * root and its value. The application supplies the flat nodes with their parents, and the tree never reorders them.
 */
export function TreeDiagram(props: TreeDiagramProps): ReactNode {
  const {
    nodes,
    direction = 'right',
    link = 'elbow',
    valueLabel,
    valueFormat,
    toneLegend,
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No hierarchy is available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize('tall');
  const readoutId = useId();
  const linked = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height="tall" />;
  }

  const inputError = treeInputError({ nodes, valueFormat, valueLabel });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const structure = nodes.length === 0 ? undefined : treeStructure(nodes);

  if (structure !== undefined && !structure.isValid) {
    return <FigureInvalid {...frame} message={structure.message} />;
  }

  const depthMax = Math.max(0, ...(structure?.order ?? []).map((entry) => entry.depth));

  if (depthMax + 1 > treeLimits.depth) {
    return <FigureInvalid {...frame} message={`This tree draws at most ${treeLimits.depth} levels.`} />;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const layout =
    structure === undefined ? undefined : treeLayout({ structure, nodes, direction, link, width: size.width });

  const lineages = new Map((structure?.order ?? []).map((entry) => [entry.id, entry.lineage]));

  const items = (structure?.order ?? []).map((entry) => {
    const node = nodeById.get(entry.id);
    const trail = entry.lineage.map((id) => nodeById.get(id)?.label ?? id);
    const hasValue = node?.value !== undefined && valueLabel !== undefined && valueFormat !== undefined;

    const value = hasValue
      ? `${valueLabel} ${formatValue({ value: node.value ?? null, locale, format: valueFormat })}`
      : undefined;

    return {
      id: entry.id,
      label: [trail.join(PATH_SEPARATOR), value, node?.detail].filter((part) => part !== undefined).join(' · '),
    };
  });

  return (
    <Chart
      {...linked}
      items={items}
      place={(id) => {
        const node = layout?.nodes.get(id);

        return node === undefined
          ? undefined
          : {
              left: node.x - DOT_RADIUS,
              top: node.y - DOT_RADIUS,
              right: node.x + DOT_RADIUS,
              bottom: node.y + DOT_RADIUS,
            };
      }}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => {
        const trail = new Set(inspected === null ? [] : (lineages.get(inspected) ?? []));
        const cursorNode = cursor === null ? undefined : layout?.nodes.get(cursor);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            seriesLegend={
              layout !== undefined && toneLegend !== undefined && toneLegend.length > 0 ? (
                <ChartLegend items={toneLegend} />
              ) : undefined
            }
            footer={
              layout === undefined ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>
              )
            }
          >
            {layout === undefined ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <GraphCanvas
                  plotRef={size.ref}
                  title={title}
                  marks="nodes"
                  readoutId={readoutId}
                  isSelectable={onSelectedChange !== undefined}
                  width={layout.width}
                  height={layout.height}
                  cursor={cursorNode}
                >
                  {layout.links.map((placed) => (
                    <LinkMark
                      key={placed.id}
                      d={placed.d}
                      tone="neutral"
                      emphasis={inspected !== null && !trail.has(placed.id) ? 'receded' : 'context'}
                    />
                  ))}
                  {items.map((item) => {
                    const node = nodeById.get(item.id);
                    const placed = layout.nodes.get(item.id);

                    return node === undefined || placed === undefined ? null : (
                      <ChartMark key={item.id} value={item.id} render={<g />}>
                        <DotMark
                          x={placed.x}
                          y={placed.y}
                          radius={DOT_RADIUS}
                          tone={node.tone ?? 'neutral'}
                          isInspected={inspected === item.id}
                          isSelected={selected === item.id}
                        />
                        <TreeLabel label={node.label} placed={placed} leafLabels={layout.leafLabels} />
                        <circle cx={placed.x} cy={placed.y} r={HIT_RADIUS} fill="transparent" />
                      </ChartMark>
                    );
                  })}
                  {cursorNode !== undefined && <GraphCursor x={cursorNode.x} y={cursorNode.y} radius={CURSOR_RADIUS} />}
                </GraphCanvas>
                <ChartData
                  label={`${title} nodes`}
                  columns={[{ id: 'node', label: 'Node' }]}
                  rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}

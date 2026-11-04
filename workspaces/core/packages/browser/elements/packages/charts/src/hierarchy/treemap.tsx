import * as stylex from '@stylexjs/stylex';
import { hierarchy, Treemap as VisxTreemap } from '@visx/hierarchy';
import type { ReactNode } from 'react';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { CategoricalValues, colorTone, validateBreakdown } from '../categorical-values.tsx';
import type { BreakdownItem } from '../categorical-values.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import type { ChartTone } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';

const styles = stylex.create({
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  treeLabel: { fill: colors.ink, fontFamily: typography.fontFamily, fontSize: typography.captionSize },
  treeRect: { stroke: colors.surface, strokeWidth: 1 },
});

export type TreemapProps = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly items: ReadonlyArray<BreakdownItem>;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection | undefined;
  readonly height?: number | undefined;
};

type TreemapDatum = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly tone: ChartTone;
  readonly children?: ReadonlyArray<TreemapDatum>;
};

export function Treemap({ title, description, items, formatValue, selection, height = 180 }: TreemapProps): ReactNode {
  const issue = validateBreakdown(items);
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const { ref, width } = usePlotWidth();

  if (issue !== undefined || !Number.isFinite(height) || height < 48) {
    return (
      <ChartInputError
        title={title}
        description={description}
        message={issue ?? 'Chart height must be at least 48 pixels.'}
      />
    );
  }

  const children = items.flatMap((item, index) =>
    item.value === null || item.value === 0
      ? []
      : [{ id: item.id, label: item.label, value: item.value, tone: colorTone(item.tone, index) }],
  );

  const root = hierarchy<TreemapDatum>({ id: 'root', label: title, value: 0, tone: 'neutral', children }, (datum) =>
    datum.children === undefined ? undefined : [...datum.children],
  ).sum((datum) => datum.value);

  return (
    <ChartFrame title={title} description={description}>
      <div ref={ref} {...stylex.props(chartStyles.plot)}>
        {total === 0 ? (
          <p {...stylex.props(styles.empty)}>No positive values to size the areas</p>
        ) : (
          <svg
            role="img"
            aria-label={`${title}. Areas compare recorded values.`}
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            {...stylex.props(chartStyles.svg)}
          >
            <VisxTreemap root={root} size={[width, height]} paddingInner={2}>
              {(tree) =>
                tree.leaves().map((node) => {
                  const hasLabelRoom = node.x1 - node.x0 > 96 && node.y1 - node.y0 > 40;

                  return (
                    <g key={node.data.id}>
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={node.x1 - node.x0}
                        height={node.y1 - node.y0}
                        fill={chartToneColors[node.data.tone]}
                        fillOpacity={0.18}
                        {...stylex.props(
                          styles.treeRect,
                          selection?.selectedId === node.data.id && chartStyles.selected,
                        )}
                      />
                      <title>
                        {node.data.label}: {formatValue(node.data.value)}
                      </title>
                      {hasLabelRoom && (
                        <svg
                          x={node.x0}
                          y={node.y0}
                          width={node.x1 - node.x0}
                          height={node.y1 - node.y0}
                          overflow="hidden"
                        >
                          <text x={8} y={18} {...stylex.props(styles.treeLabel)}>
                            {node.data.label.slice(0, Math.floor((node.x1 - node.x0 - 16) / 7))}
                          </text>
                          {formatValue(node.data.value).length * 12 < node.x1 - node.x0 - 16 && (
                            <text x={8} y={34} {...stylex.props(styles.treeLabel)}>
                              {formatValue(node.data.value)}
                            </text>
                          )}
                        </svg>
                      )}
                    </g>
                  );
                })
              }
            </VisxTreemap>
          </svg>
        )}
      </div>
      <CategoricalValues
        items={items.map((item, index) => ({
          id: item.id,
          label: item.label,
          valueLabel: item.value === null ? 'Unavailable' : formatValue(item.value),
          tone: colorTone(item.tone, index),
        }))}
        selection={selection}
      />
      {items.some((item) => item.value === null) && (
        <p {...stylex.props(styles.empty)}>Unavailable values have no area.</p>
      )}
    </ChartFrame>
  );
}

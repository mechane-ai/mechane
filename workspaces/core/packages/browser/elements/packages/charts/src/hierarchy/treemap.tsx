import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalItems, CategoricalValues, validateBreakdown } from '../categorical-values.tsx';
import type { BreakdownItem } from '../categorical-values.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { AreaMark } from './area-mark.tsx';
import { treemapLayout } from './treemap-layout.ts';

const styles = stylex.create({ note: { color: colors.muted, margin: 0, fontSize: typography.captionSize } });

const GAP = 2;
const LABEL_WIDTH = 96;

export type TreemapProps = FigureProps &
  FigureSelectionProps & {
    readonly items: ReadonlyArray<BreakdownItem>;
    readonly valueFormat: ValueFormat;
    readonly height?: PlotHeight | undefined;
  };

/**
 * Supplied nonnegative categories as areas proportional to their recorded values, with a row per category below.
 * Missing and zero values have no area. Use BreakdownBar when a declared total and an unassigned portion matter.
 */
export function Treemap({
  items,
  valueFormat,
  selected,
  onSelectedChange,
  height: plotHeight = 'compact',
  ...figure
}: TreemapProps): ReactNode {
  const { emptyLabel = 'No positive values to size the areas', ...frame } = figure;
  const { locale, title } = frame;
  const { ref, width, height } = usePlotSize(plotHeight);
  const tones = useTones();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={plotHeight} />;
  }

  const issue = validateBreakdown(items);

  if (issue !== undefined) {
    return <FigureInvalid {...frame} message={issue} />;
  }

  const values = items.map((item, index) => ({
    id: item.id,
    label: item.label,
    valueLabel: formatValue({ value: item.value, locale, format: valueFormat }),
    tone: tones({ id: item.id, tone: item.tone, index }),
  }));

  const sized = items.flatMap((item) =>
    item.value === null || item.value === 0 ? [] : [{ id: item.id, value: item.value }],
  );

  const cells = treemapLayout({ items: sized, width, height, gap: GAP });

  return (
    <Chart
      items={categoricalItems(values)}
      arrows="both"
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => (
        <FigureFrame {...frame} figure={figureProps}>
          <div ref={ref} {...stylex.props(chartStyles.plot)}>
            {sized.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <svg
                role="img"
                aria-label={`${title}. Areas compare recorded values.`}
                viewBox={`0 0 ${width} ${height}`}
                height={height}
                {...stylex.props(chartStyles.svg)}
              >
                {cells.map((cell) => {
                  const value = values.find((candidate) => candidate.id === cell.id);

                  return value === undefined ? null : (
                    <AreaMark
                      key={cell.id}
                      cell={cell}
                      tone={value.tone}
                      label={value.label}
                      valueLabel={value.valueLabel}
                      labelWidth={LABEL_WIDTH}
                      isInspected={view.inspected === cell.id}
                      isSelected={view.selected === cell.id}
                    />
                  );
                })}
              </svg>
            )}
          </div>
          <CategoricalValues title={title} items={values} view={onSelectedChange === undefined ? undefined : view} />
          {items.some((item) => item.value === null) && (
            <p {...stylex.props(styles.note)}>Unavailable values have no area.</p>
          )}
        </FigureFrame>
      )}
    />
  );
}

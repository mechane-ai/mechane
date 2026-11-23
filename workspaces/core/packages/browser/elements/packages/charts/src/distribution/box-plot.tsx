import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, IntervalMark } from '../plot/plot-marks.tsx';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { groupFrameError } from './group-plot-input.ts';
import { groupLayout, segmentBetween, shapePath } from './group-plot-layout.ts';
import type { GroupDirection, Vertex } from './group-plot-layout.ts';
import { BandCursor, GroupFigure, InkBarMark, ShapeMark, useToned } from './group-plot.tsx';

/** One group's five-number summary, computed by the application, with the outliers it left out of the whiskers. */
export type BoxGroup = {
  readonly id: string;
  readonly label: string;
  readonly tone?: ChartTone | undefined;
  /** The end of the lower whisker. */
  readonly low: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  /** The end of the upper whisker. */
  readonly high: number;
  /** Observations beyond the whiskers. They are drawn as hollow dots and never extend a whisker. */
  readonly outliers?: ReadonlyArray<number> | undefined;
  /** How many observations the summary covers. */
  readonly count?: number | undefined;
};

export type BoxPlotProps = FigureProps & {
  readonly groups: ReadonlyArray<BoxGroup>;
  readonly value: PlotAxis;
  readonly direction?: GroupDirection | undefined;
  /** What the whiskers mean, as a phrase without a final period: "Whiskers reach 1.5 × IQR". */
  readonly whiskerLabel: string;
  readonly height?: PlotHeight | undefined;
};

export const boxLimits = { groups: 40, outliers: 200 } as const;

const BOX_WIDTH_MAX = 72;
const CAP_SHARE = 0.5;
const OUTLIER_RADIUS = 3;

function summaryOf(group: BoxGroup): ReadonlyArray<number> {
  return [group.low, group.q1, group.median, group.q3, group.high];
}

function boxInputError({
  groups,
  domain,
  value,
}: Pick<BoxPlotProps, 'groups' | 'value'> & { readonly domain: NumericDomain }): string | undefined {
  const frameError = groupFrameError({
    records: groups,
    limit: boxLimits.groups,
    noun: 'groups',
    domain,
    scale: value.scale,
  });

  if (frameError !== undefined) {
    return frameError;
  }

  for (const group of groups) {
    const outliers = group.outliers ?? [];
    const summary = summaryOf(group);
    const isOrdered = summary.every((number, index) => index === 0 || number >= (summary[index - 1] ?? 0));

    if (outliers.length > boxLimits.outliers) {
      return `Group ${group.id} has more than ${boxLimits.outliers} outliers. Supply a window or a coarser summary.`;
    }

    if (
      summary.some((number) => outsideDomain(number, domain)) ||
      outliers.some((number) => outsideDomain(number, domain))
    ) {
      return `Group ${group.id} has a value that is not finite or lies outside the declared domain.`;
    }

    if (!isOrdered) {
      return `Group ${group.id} needs low ≤ q1 ≤ median ≤ q3 ≤ high.`;
    }

    if (outliers.some((number) => number >= group.low && number <= group.high)) {
      return `Group ${group.id} has an outlier inside its whiskers. Outliers lie beyond them.`;
    }

    if (group.count !== undefined && (!Number.isInteger(group.count) || group.count < 0)) {
      return `Group ${group.id} needs a count that is a whole number from zero.`;
    }
  }

  return undefined;
}

/**
 * One box per group, with the middle half of its values as a tinted box and the median as a line. Whiskers reach the
 * ends of the ordinary range and hollow dots mark outliers beyond them, and the application computes every number and
 * says what the whiskers mean. Use it to compare spread and center across groups such as models, layers or runs.
 */
export function BoxPlot(props: BoxPlotProps): ReactNode {
  const { groups, value, direction = 'columns', whiskerLabel, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No groups are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);
  const drawn = useToned(groups);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const domain =
    value.domain ??
    fitDomain({
      values: groups.flatMap((group) => [...summaryOf(group), ...(group.outliers ?? [])]),
      scale: value.scale,
    });

  const inputError = boxInputError({ groups, value, domain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const layout = groupLayout({
    width: size.width,
    height: size.height,
    direction,
    groups: drawn,
    value,
    valueDomain: domain,
    locale,
  });

  const { orient, placed } = layout;
  const half = Math.min(layout.bandwidth, BOX_WIDTH_MAX) / 2;
  const cap = half * CAP_SHARE;

  function valueText(amount: number): string {
    return formatValue({ value: amount, locale, format: value.format });
  }

  function at(across: number, amount: number): Vertex {
    return orient.point(across, layout.value.position(amount));
  }

  const items = placed.map((group) => {
    const outliers = group.outliers?.length ?? 0;

    const parts = [
      group.label,
      `Low ${valueText(group.low)}`,
      `Q1 ${valueText(group.q1)}`,
      `Median ${valueText(group.median)}`,
      `Q3 ${valueText(group.q3)}`,
      `High ${valueText(group.high)}`,
      ...(group.count === undefined ? [] : [`${formatValue({ value: group.count, locale, format: {} })} observations`]),
      `${outliers} ${outliers === 1 ? 'outlier' : 'outliers'}`,
      whiskerLabel,
    ];

    return { id: group.id, label: parts.join(' · ') };
  });

  return (
    <GroupFigure
      frame={frame}
      emptyLabel={emptyLabel}
      size={size}
      axes={layout}
      items={items}
      locate={layout.locate}
      marksLabel="groups"
      note={`${whiskerLabel}. Hollow dots mark outliers beyond the whiskers.`}
      cursor={(id) => {
        const target = placed.find((group) => group.id === id);

        return target === undefined ? null : <BandCursor {...layout.slot(target.center)} />;
      }}
      marks={(view) =>
        placed.map((group) => {
          const { center } = group;

          return (
            <g key={group.id}>
              <IntervalMark {...segmentBetween(at(center, group.low), at(center, group.q1))} tone={group.tone} />
              <IntervalMark {...segmentBetween(at(center, group.q3), at(center, group.high))} tone={group.tone} />
              <IntervalMark
                {...segmentBetween(at(center - cap, group.low), at(center + cap, group.low))}
                tone={group.tone}
              />
              <IntervalMark
                {...segmentBetween(at(center - cap, group.high), at(center + cap, group.high))}
                tone={group.tone}
              />
              <ShapeMark
                d={shapePath([
                  at(center - half, group.q1),
                  at(center - half, group.q3),
                  at(center + half, group.q3),
                  at(center + half, group.q1),
                ])}
                tone={group.tone}
                fill="soft"
                isInspected={view.inspected === group.id}
              />
              <InkBarMark
                {...segmentBetween(at(center - half, group.median), at(center + half, group.median))}
                weight="thin"
              />
              {[...new Set(group.outliers)].map((outlier) => (
                <DotMark
                  key={`${group.id}:${outlier}`}
                  {...at(center, outlier)}
                  tone={group.tone}
                  radius={OUTLIER_RADIUS}
                  isHollow
                />
              ))}
            </g>
          );
        })
      }
    />
  );
}

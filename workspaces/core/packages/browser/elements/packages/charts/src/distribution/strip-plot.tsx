import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { locateNearest } from '../plot/locate.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark } from '../plot/plot-marks.tsx';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { groupFrameError } from './group-plot-input.ts';
import { groupLayout, segmentBetween, stripOffset } from './group-plot-layout.ts';
import { GroupFigure, InkBarMark, PointCursor, useToned } from './group-plot.tsx';

export type StripGroup = { readonly id: string; readonly label: string; readonly tone?: ChartTone | undefined };

/** One observation: a run, a prompt or a sample, in the group it belongs to. */
export type StripPoint = {
  readonly id: string;
  readonly groupId: string;
  readonly value: number;
  /** What a reader calls the observation. Defaults to its identifier. */
  readonly label?: string | undefined;
};

export type StripPlotProps = FigureProps &
  FigureSelectionProps & {
    readonly groups: ReadonlyArray<StripGroup>;
    readonly points: ReadonlyArray<StripPoint>;
    readonly value: PlotAxis;
    /** One value per group id, such as its median or mean, drawn as an ink tick across the group. */
    readonly summary?: Readonly<Record<string, number>> | undefined;
    /** What the tick is: "Median". Defaults to "Summary". */
    readonly summaryLabel?: string | undefined;
    readonly height?: PlotHeight | undefined;
  };

export const stripLimits = { points: 2000, groups: 24 } as const;

const DOT_RADIUS = 3.5;
const SPREAD_SHARE = 0.8;
const TICK_SHARE = 0.45;

const styles = stylex.create({ dots: { opacity: 0.6 } });

function stripInputError({
  groups,
  points,
  summary,
  domain,
  value,
}: Pick<StripPlotProps, 'groups' | 'points' | 'summary' | 'value'> & { readonly domain: NumericDomain }):
  | string
  | undefined {
  const frameError = groupFrameError({
    records: groups,
    limit: stripLimits.groups,
    noun: 'groups',
    domain,
    scale: value.scale,
  });

  if (frameError !== undefined) {
    return frameError;
  }

  if (!hasUniqueIds(points)) {
    return 'Each point needs a unique identifier.';
  }

  if (points.length > stripLimits.points) {
    return `This chart draws at most ${stripLimits.points} points. Supply a sample or a window.`;
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const unknown = points.find((point) => !groupIds.has(point.groupId));

  if (unknown !== undefined) {
    return `Point ${unknown.id} names a group, ${unknown.groupId}, that is not in the chart.`;
  }

  if (points.some((point) => outsideDomain(point.value, domain))) {
    return 'A point has a value that is not finite or lies outside the declared domain.';
  }

  const summaries = Object.entries(summary ?? {});

  if (summaries.some(([id, number]) => !groupIds.has(id) || outsideDomain(number, domain))) {
    return 'A summary names an unknown group or lies outside the declared domain.';
  }

  return undefined;
}

/**
 * Every observation as a dot in its group's band, spread across the band by a fixed rule so a reload never moves one.
 * Dots are translucent so piles read as density, and an optional ink tick per group marks a median or mean the
 * application computed. Use it when the number of observations is small enough to show each one.
 */
export function StripPlot(props: StripPlotProps): ReactNode {
  const {
    groups,
    points,
    value,
    summary,
    summaryLabel = 'Summary',
    height = 'regular',
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No observations are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);
  const drawn = useToned(groups);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const domain =
    value.domain ??
    fitDomain({ values: [...points.map((point) => point.value), ...Object.values(summary ?? {})], scale: value.scale });

  const inputError = stripInputError({ groups, points, summary, domain, value });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const layout = groupLayout({
    width: size.width,
    height: size.height,
    direction: 'columns',
    groups: drawn,
    value,
    valueDomain: domain,
    locale,
  });

  const { orient, placed } = layout;

  function valueText(amount: number): string {
    return formatValue({ value: amount, locale, format: value.format });
  }

  const dots = placed.flatMap((group) =>
    points
      .filter((point) => point.groupId === group.id)
      .map((point, ordinal) => ({
        ...point,
        group,
        ...orient.point(
          group.center + stripOffset(ordinal) * layout.bandwidth * SPREAD_SHARE,
          layout.value.position(point.value),
        ),
      })),
  );

  const items = dots.map((dot) => {
    const typical = summary?.[dot.group.id];

    const parts = [
      dot.label ?? dot.id,
      dot.group.label,
      `${value.label} ${valueText(dot.value)}`,
      ...(typical === undefined ? [] : [`${summaryLabel} for the group ${valueText(typical)}`]),
    ];

    return { id: dot.id, label: parts.join(' · ') };
  });

  const places = new Map(dots.map((dot) => [dot.id, { left: dot.x, top: dot.y, right: dot.x, bottom: dot.y }]));
  const half = layout.bandwidth * TICK_SHARE;

  return (
    <GroupFigure
      frame={frame}
      emptyLabel={emptyLabel}
      size={size}
      axes={layout}
      items={items}
      locate={locateNearest({ marks: dots, width: layout.box.width, height: layout.box.height })}
      place={(id) => places.get(id)}
      selected={selected}
      onSelectedChange={onSelectedChange}
      marksLabel="points"
      note={
        summary === undefined
          ? 'Each dot is one observation. Dots are translucent, so overlaps look darker.'
          : `Each dot is one observation. The ink tick in each group is its ${summaryLabel.toLowerCase()}.`
      }
      cursor={(id) => {
        const target = dots.find((dot) => dot.id === id);

        return target === undefined ? null : <PointCursor x={target.x} y={target.y} radius={DOT_RADIUS} />;
      }}
      marks={(view) => (
        <>
          <g {...stylex.props(styles.dots)}>
            {dots.map((dot) => (
              <DotMark key={dot.id} mark={dot.id} x={dot.x} y={dot.y} tone={dot.group.tone} radius={DOT_RADIUS} />
            ))}
          </g>
          {placed.map((group) => {
            const typical = summary?.[group.id];

            return typical === undefined ? null : (
              <InkBarMark
                key={group.id}
                {...segmentBetween(
                  orient.point(group.center - half, layout.value.position(typical)),
                  orient.point(group.center + half, layout.value.position(typical)),
                )}
                weight="thin"
              />
            );
          })}
          {dots
            .filter((dot) => dot.id === view.inspected || dot.id === view.selected)
            .map((dot) => (
              <DotMark
                key={dot.id}
                x={dot.x}
                y={dot.y}
                tone={dot.group.tone}
                radius={DOT_RADIUS}
                isInspected={dot.id === view.inspected}
                isSelected={dot.id === view.selected}
              />
            ))}
        </>
      )}
    />
  );
}

import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { densitiesError, groupFrameError, maxDensity } from './group-plot-input.ts';
import type { DensityPoint } from './group-plot-input.ts';
import { groupLayout, segmentBetween, shapePath } from './group-plot-layout.ts';
import type { Vertex } from './group-plot-layout.ts';
import { BandCursor, GroupFigure, InkBarMark, InkDotMark, ShapeMark, useToned } from './group-plot.tsx';

/** One group's density curve, computed by the application, with the summary marks it may show inside. */
export type ViolinGroup = {
  readonly id: string;
  readonly label: string;
  readonly tone?: ChartTone | undefined;
  /** The curve in increasing `value`. Densities are zero or more and share one unit across groups. */
  readonly density: ReadonlyArray<DensityPoint>;
  readonly median?: number | undefined;
  /** The quartiles bound the bar inside the violin. Supply both or neither. */
  readonly q1?: number | undefined;
  readonly q3?: number | undefined;
};

export type ViolinPlotProps = FigureProps & {
  readonly groups: ReadonlyArray<ViolinGroup>;
  readonly value: PlotAxis;
  /** What the width means, with its unit: "Density (per unit score)". */
  readonly densityLabel: string;
  readonly height?: PlotHeight | undefined;
};

export const violinLimits = { groups: 24, densityPoints: 200 } as const;

const VIOLIN_WIDTH_MAX = 96;
const HAIRLINE_WIDTH = 0.5;

function marksOf(group: ViolinGroup): ReadonlyArray<number> {
  return [group.q1, group.median, group.q3].filter((mark) => mark !== undefined);
}

function violinInputError({
  groups,
  domain,
  value,
}: Pick<ViolinPlotProps, 'groups' | 'value'> & { readonly domain: NumericDomain }): string | undefined {
  const frameError = groupFrameError({
    records: groups,
    limit: violinLimits.groups,
    noun: 'groups',
    domain,
    scale: value.scale,
  });

  const densityError = densitiesError({ records: groups, domain, limit: violinLimits.densityPoints });

  if (frameError !== undefined || densityError !== undefined) {
    return frameError ?? densityError;
  }

  if (groups.length > 0 && maxDensity(groups) === 0) {
    return 'Every density is zero, so no violin has a width.';
  }

  for (const group of groups) {
    const marks = marksOf(group);

    if ((group.q1 === undefined) !== (group.q3 === undefined)) {
      return `Group ${group.id} has one quartile. Supply both quartiles or neither.`;
    }

    if (marks.some((mark) => outsideDomain(mark, domain))) {
      return `Group ${group.id} has a median or quartile that is not finite or lies outside the declared domain.`;
    }

    if (marks.some((mark, index) => index > 0 && mark < (marks[index - 1] ?? 0))) {
      return `Group ${group.id} needs q1 ≤ median ≤ q3.`;
    }
  }

  return undefined;
}

/**
 * One mirrored density per group, so a reader sees where values pile up and whether a distribution has more than one
 * peak. Every violin shares one density scale, so widths compare across groups. A bar and a dot inside show the
 * quartiles and median when the application supplies them, and the application computes the density.
 */
export function ViolinPlot(props: ViolinPlotProps): ReactNode {
  const { groups, value, densityLabel, height = 'regular', ...figure } = props;
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
      values: groups.flatMap((group) => [...group.density.map((point) => point.value), ...marksOf(group)]),
      scale: value.scale,
    });

  const inputError = violinInputError({ groups, value, domain });

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
  const half = Math.min(layout.bandwidth, VIOLIN_WIDTH_MAX) / 2;
  const widest = maxDensity(groups);

  function valueText(amount: number): string {
    return formatValue({ value: amount, locale, format: value.format });
  }

  function isWide(point: DensityPoint): boolean {
    return (half * point.density) / widest >= HAIRLINE_WIDTH;
  }

  function at(across: number, amount: number): Vertex {
    return orient.point(across, layout.value.position(amount));
  }

  const items = placed.map((group) => {
    const median = group.median === undefined ? 'Median not supplied' : `Median ${valueText(group.median)}`;

    const quartiles =
      group.q1 === undefined || group.q3 === undefined
        ? 'Quartiles not supplied'
        : `Quartiles ${valueText(group.q1)} – ${valueText(group.q3)}`;

    return { id: group.id, label: [group.label, median, quartiles].join(' · ') };
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
      note={`Width shows ${densityLabel}. All violins share one density scale.`}
      cursor={(id) => {
        const target = placed.find((group) => group.id === id);

        return target === undefined ? null : <BandCursor {...layout.slot(target.center)} />;
      }}
      marks={(view) =>
        placed.map((group) => {
          const { center } = group;

          const first = group.density.findIndex(isWide);
          const last = group.density.findLastIndex(isWide);
          const covered = group.density.slice(Math.max(0, first - 1), last + 2);
          const right = covered.map((point) => at(center + (half * point.density) / widest, point.value));
          const left = covered.map((point) => at(center - (half * point.density) / widest, point.value));

          return (
            <g key={group.id}>
              {first !== -1 && (
                <ShapeMark
                  d={shapePath([...right, ...left.toReversed()])}
                  tone={group.tone}
                  fill="strong"
                  isInspected={view.inspected === group.id}
                />
              )}
              {group.q1 !== undefined && group.q3 !== undefined && (
                <InkBarMark {...segmentBetween(at(center, group.q1), at(center, group.q3))} weight="thick" />
              )}
              {group.median !== undefined && <InkDotMark {...at(center, group.median)} />}
            </g>
          );
        })
      }
    />
  );
}

import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { usePlotWidth } from '../plot-width.ts';
import type { NumericDomain } from './distribution-input.ts';

export const distributionGeometry = { height: 160 } as const;

const tickFractions = [0, 0.5, 1] as const;
const NARROW_ROW = '@container (max-width:420px)';

export const distributionStyles = stylex.create({
  plot: { minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, max-content) minmax(0, 1fr)', gap: spacing.sm },
  yAxis: {
    height: distributionGeometry.height,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'end',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    maxWidth: 120,
    overflowWrap: 'anywhere',
  },
  plotArea: { minWidth: 0 },
  svg: { display: 'block', width: '100%', height: distributionGeometry.height, overflow: 'hidden' },
  grid: { stroke: colors.line, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
  axis: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  tick: { flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' },
  middleTick: { textAlign: 'center' },
  endTick: { textAlign: 'end' },
  axisNames: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: spacing.md },
  label: {
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  values: { display: 'grid', minWidth: 0, containerType: 'inline-size' },
  value: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    minWidth: 0,
    width: '100%',
  },
  summary: { minWidth: 0, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', textAlign: 'end' },
  row: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(100px, 1fr) minmax(120px, 2fr)', [NARROW_ROW]: 'minmax(0, 1fr)' },
    gap: spacing.md,
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
  },
  rowAxis: { boxSizing: 'border-box', paddingInline: spacing.sm },
  axisSpacer: { display: { default: 'block', [NARROW_ROW]: 'none' } },
  rowLabel: { minWidth: 0, display: 'grid', gap: spacing.xxs, overflowWrap: 'anywhere' },
  rowValue: { color: colors.muted, fontVariantNumeric: 'tabular-nums' },
  rowSvg: { display: 'block', width: '100%', height: 28, overflow: 'hidden' },
  empty: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  baseline: { stroke: colors.line, vectorEffect: 'non-scaling-stroke' },
  missing: { fill: colors.canvas, stroke: colors.muted, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
});

type NumericPlotProps = {
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly formatX: (value: number) => string;
  readonly formatY: (value: number) => string;
  readonly children: (width: number) => ReactNode;
};

export function NumericPlot({
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  formatX,
  formatY,
  children,
}: NumericPlotProps): ReactNode {
  const { ref, width } = usePlotWidth();
  const xTicks = tickFractions.map((fraction) => xDomain[0] + fraction * (xDomain[1] - xDomain[0]));
  const yTicks = tickFractions.map((fraction) => yDomain[1] - fraction * (yDomain[1] - yDomain[0]));

  return (
    <div {...stylex.props(distributionStyles.plot)}>
      <div {...stylex.props(distributionStyles.axisNames)}>
        <span {...stylex.props(distributionStyles.label)}>{yLabel}</span>
        <span {...stylex.props(distributionStyles.label)}>{xLabel}</span>
      </div>
      <div aria-hidden {...stylex.props(distributionStyles.yAxis)}>
        {yTicks.map((tick) => (
          <span key={tick}>{formatY(tick)}</span>
        ))}
      </div>
      <div ref={ref} {...stylex.props(distributionStyles.plotArea)}>
        <svg
          aria-hidden
          viewBox={`0 0 ${width} ${distributionGeometry.height}`}
          preserveAspectRatio="none"
          {...stylex.props(distributionStyles.svg)}
        >
          {tickFractions.map((fraction) => (
            <line
              key={fraction}
              x1={0}
              x2={width}
              y1={distributionGeometry.height * fraction}
              y2={distributionGeometry.height * fraction}
              {...stylex.props(distributionStyles.grid)}
            />
          ))}
          {children(width)}
        </svg>
      </div>
      <span />
      <div aria-hidden {...stylex.props(distributionStyles.axis)}>
        {xTicks.map((tick, index) => (
          <span
            key={tick}
            {...stylex.props(
              distributionStyles.tick,
              index === 1 && distributionStyles.middleTick,
              index === 2 && distributionStyles.endTick,
            )}
          >
            {formatX(tick)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DomainLabels({
  domain,
  formatValue,
}: {
  readonly domain: NumericDomain;
  readonly formatValue: (value: number) => string;
}): ReactNode {
  return (
    <div {...stylex.props(distributionStyles.axis)}>
      <span {...stylex.props(distributionStyles.tick)}>{formatValue(domain[0])}</span>
      <span {...stylex.props(distributionStyles.tick, distributionStyles.endTick)}>{formatValue(domain[1])}</span>
    </div>
  );
}

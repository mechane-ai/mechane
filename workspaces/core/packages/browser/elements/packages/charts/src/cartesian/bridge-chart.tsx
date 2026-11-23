import * as stylex from '@stylexjs/stylex';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { ChartInspection, ChartInspectionTitle, inspectionReadout } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartSvgPlot, locateBand, plotLabel } from '../chart.tsx';
import { usePlotWidth } from '../plot-width.ts';
import { bridgeDomain, bridgeLevels, validateBridge } from './bridge-data.ts';
import type { BridgeLevel, BridgeStep } from './bridge-data.ts';
import { referenceGutterWidth, ReferenceLines, validateReferenceLines } from './reference-lines.tsx';
import type { ChartReferenceLine } from './reference-lines.tsx';

export type { BridgeStep } from './bridge-data.ts';

export type BridgeChartProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly report?: ChartReport | undefined;
  readonly steps: ReadonlyArray<BridgeStep>;
  /** Formats totals and running levels exactly, for labels, inspection and accessible values. */
  readonly formatValue: (value: number) => string;
  /** Formats a signed change. Absent prefixes the formatted magnitude with + or −. */
  readonly formatChange?: ((value: number) => string) | undefined;
  /** Formats compact value-axis ticks. Absent uses `formatValue`. */
  readonly formatTick?: ((value: number) => string) | undefined;
  /** A fixed value domain shared with related charts. Absent fits zero and every running total. */
  readonly domain?: readonly [number, number] | undefined;
  /** Labelled values drawn across the plot, such as a target for the final total. */
  readonly referenceLines?: ReadonlyArray<ChartReferenceLine> | undefined;
  readonly selection?: ChartSelection | undefined;
  readonly height?: number | undefined;
};

const styles = stylex.create({
  plot: { marginBlock: spacing.md },
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  guide: { fill: colors.canvas },
  bar: (color: string, outline: string) => ({ fill: color, stroke: outline, strokeWidth: 1 }),
  connector: { stroke: colors.faint, strokeWidth: 1, strokeDasharray: '3 2', vectorEffect: 'non-scaling-stroke' },
  unknown: {
    fill: 'none',
    stroke: colors.faint,
    strokeWidth: 1,
    strokeDasharray: '3 2',
    vectorEffect: 'non-scaling-stroke',
  },
});

const DEFAULT_HEIGHT = 240;
const PLOT_TOP_PX = 24;
const AXIS_SPACE_PX = 28;
const VALUE_LABEL_GAP_PX = 6;
const BELOW_LABEL_OFFSET_PX = 14;
const UNKNOWN_HEIGHT_PX = 12;
const CHARACTER_WIDTH_PX = 7;
const LABEL_LINE_PX = 14;
const LABEL_GAP_PX = 4;

const labelWeights = {
  start: chartStyles.strongLabel,
  change: undefined,
  total: chartStyles.strongLabel,
} satisfies Record<BridgeStep['kind'], stylex.StyleXStyles | undefined>;

function signedChange(formatValue: (value: number) => string): (value: number) => string {
  return (value) => {
    if (value === 0) {
      return formatValue(0);
    }

    return `${value > 0 ? '+' : '−'}${formatValue(Math.abs(value))}`;
  };
}

/** The column's own value: a known change even when its position is unknown, or a known level. */
function columnText({
  level,
  formatValue,
  formatChange,
}: {
  readonly level: BridgeLevel;
  readonly formatValue: (value: number) => string;
  readonly formatChange: (value: number) => string;
}): string {
  if (level.step.kind === 'change' && level.step.value !== null) {
    return formatChange(level.step.value);
  }

  return level.to === null ? '—' : formatValue(level.to);
}

function levelText({
  level,
  formatValue,
  formatChange,
}: {
  readonly level: BridgeLevel;
  readonly formatValue: (value: number) => string;
  readonly formatChange: (value: number) => string;
}): string {
  if (level.step.kind === 'change') {
    return level.step.value === null ? 'Unavailable' : formatChange(level.step.value);
  }

  return level.to === null ? 'Unavailable' : formatValue(level.to);
}

function runningText({
  level,
  formatValue,
}: {
  readonly level: BridgeLevel;
  readonly formatValue: (value: number) => string;
}): string {
  if (level.from === null || level.to === null) {
    return 'Unavailable';
  }

  return `${formatValue(level.from)} → ${formatValue(level.to)}`;
}

/** Where a column is drawn, and the baseline of its value label. A column with an unknown end is a dashed marker. */
function columnBox(level: BridgeLevel, y: (value: number) => number, bottom: number) {
  if (level.from === null || level.to === null) {
    const top = Math.min(bottom - UNKNOWN_HEIGHT_PX, y(level.from ?? 0) - UNKNOWN_HEIGHT_PX / 2);

    return { isKnown: false, top, height: UNKNOWN_HEIGHT_PX, labelY: top - VALUE_LABEL_GAP_PX };
  }

  const upper = Math.max(level.from, level.to);
  const lower = Math.min(level.from, level.to);
  const top = y(upper);
  const isBelowZero = upper <= 0 && lower < 0;

  return {
    isKnown: true,
    top,
    height: Math.max(1, y(lower) - top),
    labelY: isBelowZero ? y(lower) + BELOW_LABEL_OFFSET_PX : top - VALUE_LABEL_GAP_PX,
  };
}

type ValueLabel = {
  readonly id: string;
  readonly kind: BridgeStep['kind'];
  readonly text: string;
  readonly x: number;
  readonly y: number;
};

/**
 * The value labels that fit without touching each other. Totals claim their place before changes, and a change keeps
 * its label only when it clears every label already placed. A label left out stays in the readout and the table.
 */
function clearLabels(labels: ReadonlyArray<ValueLabel>): ReadonlyArray<ValueLabel> {
  const placed: Array<ValueLabel> = [];

  for (const label of [
    ...labels.filter(({ kind }) => kind !== 'change'),
    ...labels.filter(({ kind }) => kind === 'change'),
  ]) {
    const isClear = placed.every((other) => {
      const reach = ((label.text.length + other.text.length) * CHARACTER_WIDTH_PX) / 2 + LABEL_GAP_PX;

      return Math.abs(label.x - other.x) >= reach || Math.abs(label.y - other.y) >= LABEL_LINE_PX;
    });

    if (isClear) {
      placed.push(label);
    }
  }

  return placed;
}

/**
 * Explains how a starting total becomes a result through signed changes, such as an amount and the deductions that
 * leave a remainder. Columns float from the running total, and dashed connectors carry it to the next step. Use
 * BarChart for independent categories and BreakdownBar for parts of one total; the application supplies every change.
 */
export function BridgeChart({
  title,
  description,
  report,
  steps,
  formatValue,
  formatChange = signedChange(formatValue),
  formatTick = formatValue,
  domain,
  referenceLines = [],
  selection,
  height = DEFAULT_HEIGHT,
}: BridgeChartProps): ReactNode {
  const { ref, width } = usePlotWidth();
  const inspectionId = useId();

  const heightIssue = !Number.isFinite(height) || height < 96 ? 'Chart height must be at least 96 pixels.' : undefined;
  const levels = bridgeLevels(steps);
  const valueDomain = domain ?? bridgeDomain(levels);

  const issue =
    heightIssue ??
    validateBridge({ steps, domain }) ??
    validateReferenceLines({ lines: referenceLines, domain: valueDomain });

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} report={report} message={issue} />;
  }

  const referenceRows: ReadonlyArray<ChartInspectionRow> = referenceLines.map((line) => ({
    id: line.id,
    label: line.label,
    tone: line.tone ?? 'neutral',
    shape: 'dashed',
    value: formatValue(line.value),
  }));

  function reading(id: string | null) {
    const level = levels.find((candidate) => candidate.step.id === id);

    if (level === undefined) {
      return { level, label: undefined, summary: undefined, rows: [] };
    }

    const running: ReadonlyArray<ChartInspectionRow> =
      level.step.kind === 'change'
        ? [{ id: 'running', label: 'Running total', tone: 'neutral', value: runningText({ level, formatValue }) }]
        : [];

    return {
      level,
      label: level.step.label,
      summary: levelText({ level, formatValue, formatChange }),
      rows: [...running, ...referenceRows],
    };
  }

  const bottom = height - AXIS_SPACE_PX;
  const y = scaleLinear({ domain: [...valueDomain], range: [bottom, PLOT_TOP_PX] });
  const ticks = y.ticks(4);
  const left = Math.max(44, ...ticks.map((tick) => formatTick(tick).length * CHARACTER_WIDTH_PX + 12));
  const gutter = referenceGutterWidth({ lines: referenceLines, formatValue: formatTick });
  const right = Math.max(left + 1, width - 16 - gutter);
  const x = scaleBand({ domain: levels.map((level) => level.step.id), range: [left, right], padding: 0.28 });
  const items = levels.map((level) => ({ id: level.step.id, label: level.step.label }));
  const labelCharacters = Math.max(1, Math.floor((x.step() - 8) / CHARACTER_WIDTH_PX));

  function axisLabel(step: BridgeStep): string {
    const label = step.axisLabel ?? step.label;

    return label.length > labelCharacters ? `${label.slice(0, labelCharacters - 1)}…` : label;
  }

  const valueLabels = clearLabels(
    levels.map((level) => ({
      id: level.step.id,
      kind: level.step.kind,
      text: columnText({ level, formatValue, formatChange }),
      x: (x(level.step.id) ?? left) + x.bandwidth() / 2,
      y: columnBox(level, y, bottom).labelY,
    })),
  );

  return (
    <Chart
      items={items}
      readout={(id) => inspectionReadout(reading(id))}
      locate={locateBand({ ids: items.map((item) => item.id), start: left, step: x.step(), width })}
      selected={selection?.selectedId ?? null}
      onSelect={selection?.onSelect}
      render={(figure, { inspected, cursor }) => {
        const active = reading(inspected);

        return (
          <ChartFrame
            figure={figure}
            title={
              <ChartInspectionTitle
                title={title}
                detail={active.level === undefined ? undefined : `${active.label} · ${active.summary}`}
              />
            }
            description={description}
            report={report}
          >
            <ChartData
              label={`${title} steps`}
              columns={[
                { id: 'step', label: 'Step' },
                { id: 'value', label: 'Value' },
                { id: 'running', label: 'Running total' },
              ]}
              rows={[
                ...levels.map((level) => ({
                  id: level.step.id,
                  values: [
                    level.step.label,
                    levelText({ level, formatValue, formatChange }),
                    level.step.kind === 'change'
                      ? runningText({ level, formatValue })
                      : levelText({ level, formatValue, formatChange }),
                  ],
                })),
                ...referenceLines.map((line) => ({
                  id: `reference:${line.id}`,
                  values: [line.label, formatValue(line.value), ''],
                })),
              ]}
            />
            <ChartInspection
              id={inspectionId}
              label={active.label}
              summary={active.summary}
              legend={[]}
              hasLegend={false}
              rows={active.rows}
              x={(x(inspected ?? '') ?? left) + x.bandwidth() / 2}
              width={width}
              offset={x.bandwidth() / 2 + 8}
            />
            <div ref={ref} {...stylex.props(chartStyles.plot, styles.plot)}>
              {levels.length === 0 ? (
                <p {...stylex.props(styles.empty)}>No steps</p>
              ) : (
                <ChartSvgPlot
                  role="img"
                  aria-label={plotLabel({ title, marks: 'steps', isSelectable: selection !== undefined })}
                  aria-describedby={inspectionId}
                  viewBox={`0 0 ${width} ${height}`}
                  height={height}
                  {...stylex.props(chartStyles.svg, chartStyles.inspectable, stylex.defaultMarker())}
                >
                  {inspected !== null && (
                    <rect
                      x={(x(inspected) ?? left) - (x.step() - x.bandwidth()) / 2}
                      y={PLOT_TOP_PX}
                      width={x.step()}
                      height={bottom - PLOT_TOP_PX}
                      {...stylex.props(styles.guide)}
                    />
                  )}
                  {ticks.map((tick) => (
                    <g key={tick}>
                      <line
                        x1={left}
                        x2={right}
                        y1={y(tick)}
                        y2={y(tick)}
                        {...stylex.props(tick === 0 ? chartStyles.baseline : chartStyles.grid)}
                      />
                      <text
                        x={left - 8}
                        y={y(tick)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        {...stylex.props(chartStyles.label, chartStyles.tick)}
                      >
                        {formatTick(tick)}
                      </text>
                    </g>
                  ))}
                  {levels.map((level, index) => {
                    const next = levels[index + 1];
                    const start = x(level.step.id) ?? left;

                    if (next === undefined || level.to === null || next.from === null) {
                      return null;
                    }

                    return (
                      <line
                        key={`connector:${level.step.id}`}
                        x1={start + x.bandwidth()}
                        x2={x(next.step.id) ?? start}
                        y1={y(level.to)}
                        y2={y(level.to)}
                        {...stylex.props(styles.connector)}
                      />
                    );
                  })}
                  {levels.map((level) => (
                    <BridgeColumn
                      key={level.step.id}
                      level={level}
                      x={x(level.step.id) ?? left}
                      width={x.bandwidth()}
                      y={y}
                      bottom={bottom}
                      height={height}
                      axisLabel={axisLabel(level.step)}
                      isSelected={selection?.selectedId === level.step.id}
                    />
                  ))}
                  <ReferenceLines
                    lines={referenceLines}
                    y={y}
                    left={left}
                    right={right}
                    top={PLOT_TOP_PX}
                    bottom={bottom}
                    formatValue={formatTick}
                  />
                  {valueLabels.map((label) => (
                    <text
                      key={label.id}
                      x={label.x}
                      y={label.y}
                      textAnchor="middle"
                      {...stylex.props(chartStyles.label, labelWeights[label.kind], chartStyles.haloLabel)}
                    >
                      {label.text}
                    </text>
                  ))}
                  {cursor !== null && (
                    <ChartCursor
                      x={(x(cursor) ?? left) + x.bandwidth() / 2}
                      top={PLOT_TOP_PX}
                      bottom={bottom}
                      width={Math.max(8, x.bandwidth())}
                    />
                  )}
                </ChartSvgPlot>
              )}
            </div>
          </ChartFrame>
        );
      }}
    />
  );
}

type BridgeColumnProps = {
  readonly level: BridgeLevel;
  readonly x: number;
  readonly width: number;
  readonly y: (value: number) => number;
  readonly bottom: number;
  readonly height: number;
  readonly axisLabel: string;
  readonly isSelected: boolean;
};

function BridgeColumn({ level, x, width, y, bottom, height, axisLabel, isSelected }: BridgeColumnProps): ReactNode {
  const box = columnBox(level, y, bottom);

  return (
    <g>
      <rect
        x={x}
        y={box.top}
        width={width}
        height={box.height}
        {...stylex.props(
          box.isKnown ? styles.bar(chartToneColors[level.tone], chartToneOutlines[level.tone]) : styles.unknown,
          box.isKnown && isSelected && chartStyles.selected,
        )}
      />
      <text x={x + width / 2} y={height - 4} textAnchor="middle" {...stylex.props(chartStyles.label, chartStyles.tick)}>
        {axisLabel}
      </text>
    </g>
  );
}

import * as stylex from '@stylexjs/stylex';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useEffect, useId, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { ChartInspection, ChartInspectionTitle, inspectionReadout } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { ChartSvgSurface } from '../chart-surface.tsx';
import { chartStyles } from '../chart-theme.ts';
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

type Inspection = { readonly id: string; readonly source: 'pointer' | 'keyboard' };

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
  const { ref, width, element } = usePlotWidth();
  const inspectionId = useId();
  const [inspection, setInspection] = useState<Inspection>();
  const [keyboardId, setKeyboardId] = useState<string>();

  useEffect(() => {
    function dismiss(event: globalThis.PointerEvent): void {
      if (event.target instanceof Node && element?.contains(event.target) !== true) {
        setInspection(undefined);
      }
    }

    document.addEventListener('pointerdown', dismiss);

    return () => document.removeEventListener('pointerdown', dismiss);
  }, [element]);

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

  const active = levels.find((level) => level.step.id === inspection?.id);
  const selected = levels.find((level) => level.step.id === selection?.selectedId);
  const cursor = levels.find((level) => level.step.id === keyboardId) ?? selected ?? levels[0];
  const summary = active === undefined ? undefined : levelText({ level: active, formatValue, formatChange });

  const rows: ReadonlyArray<ChartInspectionRow> =
    active?.step.kind === 'change'
      ? [{ id: 'running', label: 'Running total', tone: 'neutral', value: runningText({ level: active, formatValue }) }]
      : [];

  const referenceRows: ReadonlyArray<ChartInspectionRow> = referenceLines.map((line) => ({
    id: line.id,
    label: line.label,
    tone: line.tone ?? 'neutral',
    shape: 'dashed',
    value: formatValue(line.value),
  }));

  const readoutRows = active === undefined ? [] : [...rows, ...referenceRows];
  const bottom = height - AXIS_SPACE_PX;
  const y = scaleLinear({ domain: [...valueDomain], range: [bottom, PLOT_TOP_PX] });
  const ticks = y.ticks(4);
  const left = Math.max(44, ...ticks.map((tick) => formatTick(tick).length * CHARACTER_WIDTH_PX + 12));
  const gutter = referenceGutterWidth({ lines: referenceLines, formatValue: formatTick });
  const right = Math.max(left + 1, width - 16 - gutter);
  const x = scaleBand({ domain: levels.map((level) => level.step.id), range: [left, right], padding: 0.28 });
  const items = levels.map((level) => ({ id: level.step.id, label: level.step.label }));
  const labelCharacters = Math.max(1, Math.floor((x.step() - 8) / CHARACTER_WIDTH_PX));

  function inspectPointer(event: PointerEvent<SVGSVGElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = ((event.clientX - bounds.left) / bounds.width) * width;
    const index = Math.floor((point - left) / x.step());
    const level = levels[Math.max(0, Math.min(levels.length - 1, index))];

    if (level === undefined) {
      return;
    }

    if (event.type === 'pointerdown') {
      setKeyboardId(level.step.id);
    }

    setInspection({ id: level.step.id, source: 'pointer' });
  }

  function axisLabel(step: BridgeStep): string {
    const label = step.axisLabel ?? step.label;

    return label.length > labelCharacters ? `${label.slice(0, labelCharacters - 1)}…` : label;
  }

  return (
    <ChartFrame
      title={
        <ChartInspectionTitle
          title={title}
          detail={active === undefined ? undefined : `${active.step.label} · ${summary ?? ''}`}
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
        label={active?.step.label}
        summary={summary}
        legend={[]}
        hasLegend={false}
        rows={readoutRows}
        x={(x(active?.step.id ?? '') ?? left) + x.bandwidth() / 2}
        width={width}
        offset={x.bandwidth() / 2 + 8}
        source={inspection?.source}
      />
      <div ref={ref} {...stylex.props(chartStyles.plot, styles.plot)}>
        {levels.length === 0 ? (
          <p {...stylex.props(styles.empty)}>No steps</p>
        ) : (
          <ChartSvgSurface
            role="img"
            aria-label={`${title}. Use arrow keys to inspect steps.${selection === undefined ? '' : ' Press Enter to select.'}`}
            aria-describedby={inspectionId}
            tabIndex={0}
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            controls={{
              items,
              cursor: cursor?.step.id,
              inspected: active?.step.id,
              selected: selected?.step.id,
              readout: inspectionReadout({ label: active?.step.label, summary, rows: readoutRows }),
              onInspect: (id) => {
                setKeyboardId(id);
                setInspection({ id, source: 'keyboard' });
              },
              onDismiss: () => setInspection(undefined),
              onSelect: selection?.onSelect,
            }}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) {
                const level = selected ?? levels[0];

                setKeyboardId(level?.step.id);
                setInspection(level === undefined ? undefined : { id: level.step.id, source: 'keyboard' });
              }
            }}
            onPointerMove={(event) => {
              if (event.pointerType === 'mouse') {
                inspectPointer(event);
              }
            }}
            onPointerDown={inspectPointer}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse' && inspection?.source === 'pointer') {
                setInspection(undefined);
              }
            }}
            onBlur={() => setInspection(undefined)}
            onClick={() => {
              if (active !== undefined) {
                selection?.onSelect(active.step.id);
              }
            }}
            {...stylex.props(chartStyles.svg, chartStyles.inspectable, stylex.defaultMarker())}
          >
            {active !== undefined && (
              <rect
                x={(x(active.step.id) ?? left) - (x.step() - x.bandwidth()) / 2}
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
                label={columnText({ level, formatValue, formatChange })}
                axisLabel={axisLabel(level.step)}
                isHighlighted={active?.step.id === level.step.id || selected?.step.id === level.step.id}
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
            {cursor !== undefined && (
              <ChartCursor
                x={(x(cursor.step.id) ?? left) + x.bandwidth() / 2}
                top={PLOT_TOP_PX}
                bottom={bottom}
                width={Math.max(8, x.bandwidth())}
              />
            )}
          </ChartSvgSurface>
        )}
      </div>
    </ChartFrame>
  );
}

type BridgeColumnProps = {
  readonly level: BridgeLevel;
  readonly x: number;
  readonly width: number;
  readonly y: (value: number) => number;
  readonly bottom: number;
  readonly height: number;
  readonly label: string;
  readonly axisLabel: string;
  readonly isHighlighted: boolean;
};

function BridgeColumn({
  level,
  x,
  width,
  y,
  bottom,
  height,
  label,
  axisLabel,
  isHighlighted,
}: BridgeColumnProps): ReactNode {
  const center = x + width / 2;

  const axisText = (
    <text x={center} y={height - 4} textAnchor="middle" {...stylex.props(chartStyles.label, chartStyles.tick)}>
      {axisLabel}
    </text>
  );

  if (level.from === null || level.to === null) {
    const anchor = level.from ?? 0;
    const top = Math.min(bottom - UNKNOWN_HEIGHT_PX, y(anchor) - UNKNOWN_HEIGHT_PX / 2);

    return (
      <g>
        <rect x={x} y={top} width={width} height={UNKNOWN_HEIGHT_PX} {...stylex.props(styles.unknown)} />
        <text x={center} y={top - VALUE_LABEL_GAP_PX} textAnchor="middle" {...stylex.props(chartStyles.label)}>
          {label}
        </text>
        {axisText}
      </g>
    );
  }

  const upper = Math.max(level.from, level.to);
  const lower = Math.min(level.from, level.to);
  const top = y(upper);
  const barHeight = Math.max(1, y(lower) - top);
  const isBelowZero = upper <= 0 && lower < 0;
  const labelY = isBelowZero ? y(lower) + BELOW_LABEL_OFFSET_PX : top - VALUE_LABEL_GAP_PX;

  return (
    <g>
      <rect
        x={x}
        y={top}
        width={width}
        height={barHeight}
        {...stylex.props(
          styles.bar(chartToneColors[level.tone], chartToneOutlines[level.tone]),
          isHighlighted && chartStyles.selected,
        )}
      />
      <text
        x={center}
        y={labelY}
        textAnchor="middle"
        {...stylex.props(chartStyles.label, labelWeights[level.step.kind], chartStyles.haloLabel)}
      >
        {label}
      </text>
      {axisText}
    </g>
  );
}

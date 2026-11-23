import { useId } from 'react';
import type { ReactNode } from 'react';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartInspection, inspectionReadout } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { Chart, plotLabel } from '../chart.tsx';
import { formatValue, MISSING_VALUE_TEXT } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { categoryPlot, fitDomain } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { BarMark, ConnectorMark, LabelMark, RuleMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import type { NumericDomain } from '../plot/scale.ts';
import { bridgeDomain, bridgeLevels, validateBridge } from './bridge-data.ts';
import type { BridgeLevel, BridgeStep } from './bridge-data.ts';
import { ReferenceMarks, validateReferenceLines } from './reference-lines.tsx';
import type { ChartReferenceLine } from './reference-lines.tsx';
import { clearLabels } from './value-labels.ts';

export type { BridgeStep } from './bridge-data.ts';

export type BridgeChartProps = FigureProps &
  FigureSelectionProps & {
    readonly steps: ReadonlyArray<BridgeStep>;
    /** How totals and running levels are written in labels, inspection and exact values. */
    readonly valueFormat: ValueFormat;
    /** How a signed change is written. Absent writes the value format with its sign. */
    readonly changeFormat?: ValueFormat | undefined;
    /** How the value axis writes its ticks. Absent uses the compact form of `valueFormat`. */
    readonly tickFormat?: ValueFormat | undefined;
    /**
     * The value axis title, with its unit: "Cost (USD)". With a title the ticks leave a `unit` style out, so the unit
     * is written once. Absent draws no title.
     */
    readonly valueLabel?: string | undefined;
    /** A fixed value domain shared with related charts. Absent fits zero and every running total on round bounds. */
    readonly domain?: NumericDomain | undefined;
    /** Labelled values drawn across the plot, such as a target for the final total. */
    readonly referenceLines?: ReadonlyArray<ChartReferenceLine> | undefined;
    readonly height?: PlotHeight | undefined;
  };

/** Room above the tallest column for its value label, in pixels. */
const LABEL_INSET = 12;
const VALUE_LABEL_GAP = 6;
const BELOW_LABEL_OFFSET = 14;
const UNKNOWN_HEIGHT = 12;
const CURSOR_MIN = 8;
const INSPECTOR_OFFSET = 8;
const HALF = 0.5;

type ValueText = (value: number) => string;
type Position = (value: number) => number;

/** The default change format: the value format with its sign, or a sign before a function format's magnitude. */
function signedFormat(format: ValueFormat): ValueFormat {
  if (typeof format !== 'function') {
    return { ...format, signDisplay: 'exceptZero' };
  }

  return (value) => (value === 0 ? format(0) : `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`);
}

/** The column's own value: a known change even when its position is unknown, or a known level. */
function columnText({
  level,
  valueText,
  changeText,
}: {
  readonly level: BridgeLevel;
  readonly valueText: ValueText;
  readonly changeText: ValueText;
}): string {
  if (level.step.kind === 'change' && level.step.value !== null) {
    return changeText(level.step.value);
  }

  return level.to === null ? '—' : valueText(level.to);
}

function levelText({
  level,
  valueText,
  changeText,
}: {
  readonly level: BridgeLevel;
  readonly valueText: ValueText;
  readonly changeText: ValueText;
}): string {
  if (level.step.kind === 'change') {
    return level.step.value === null ? MISSING_VALUE_TEXT : changeText(level.step.value);
  }

  return level.to === null ? MISSING_VALUE_TEXT : valueText(level.to);
}

function runningText({ level, valueText }: { readonly level: BridgeLevel; readonly valueText: ValueText }): string {
  if (level.from === null || level.to === null) {
    return MISSING_VALUE_TEXT;
  }

  return `${valueText(level.from)} → ${valueText(level.to)}`;
}

/** Where a column is drawn, and the baseline of its value label. A column with an unknown end is a dashed marker. */
function columnBox(level: BridgeLevel, y: Position, bottom: number) {
  if (level.from === null || level.to === null) {
    const top = Math.min(bottom - UNKNOWN_HEIGHT, y(level.from ?? 0) - UNKNOWN_HEIGHT * HALF);

    return { isKnown: false, top, height: UNKNOWN_HEIGHT, labelY: top - VALUE_LABEL_GAP };
  }

  const upper = Math.max(level.from, level.to);
  const lower = Math.min(level.from, level.to);
  const top = y(upper);
  const isBelowZero = upper <= 0 && lower < 0;

  return {
    isKnown: true,
    top,
    height: Math.max(1, y(lower) - top),
    labelY: isBelowZero ? y(lower) + BELOW_LABEL_OFFSET : top - VALUE_LABEL_GAP,
  };
}

/**
 * Explains how a starting total becomes a result through signed changes, such as an amount and the deductions that
 * leave a remainder. Columns float from the running total, and dashed connectors carry it to the next step. Use
 * BarChart for independent categories and BreakdownBar for parts of one total; the application supplies every change.
 */
export function BridgeChart({
  steps,
  valueFormat,
  changeFormat = signedFormat(valueFormat),
  tickFormat,
  valueLabel,
  domain,
  referenceLines = [],
  selected,
  onSelectedChange,
  height: plotHeight = 'regular',
  ...figure
}: BridgeChartProps): ReactNode {
  const { emptyLabel = 'No steps', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(plotHeight);
  const inspectionId = useId();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={plotHeight} />;
  }

  const levels = bridgeLevels(steps);
  const reached = bridgeDomain(levels);
  const valueDomain = domain ?? fitDomain({ values: [...reached, ...referenceLines.map((line) => line.value)] });

  const issue =
    validateBridge({ steps, domain }) ?? validateReferenceLines({ lines: referenceLines, domain: valueDomain });

  if (issue !== undefined) {
    return <FigureInvalid {...frame} message={issue} />;
  }

  function formatText(format: ValueFormat): ValueText {
    return (value) => formatValue({ value, locale, format });
  }

  const valueText = formatText(valueFormat);
  const changeText = formatText(changeFormat);

  const referenceRows: ReadonlyArray<ChartInspectionRow> = referenceLines.map((line) => ({
    id: line.id,
    label: line.label,
    tone: line.tone ?? 'neutral',
    shape: 'dashed',
    value: valueText(line.value),
  }));

  function reading(id: string | null) {
    const level = levels.find((candidate) => candidate.step.id === id);

    if (level === undefined) {
      return { level, label: undefined, summary: undefined, rows: [] };
    }

    const running: ReadonlyArray<ChartInspectionRow> =
      level.step.kind === 'change'
        ? [{ id: 'running', label: 'Running total', tone: 'neutral', value: runningText({ level, valueText }) }]
        : [];

    return {
      level,
      label: level.step.label,
      summary: levelText({ level, valueText, changeText }),
      rows: [...running, ...referenceRows],
    };
  }

  const plot = categoryPlot({
    width: size.width,
    height: size.height,
    direction: 'columns',
    categories: levels.map((level) => ({ id: level.step.id, label: level.step.axisLabel ?? level.step.label })),
    value: { label: valueLabel ?? '', format: valueFormat, tickFormat },
    valueDomain,
    locale,
    topInset: LABEL_INSET,
    hasValueTitle: valueLabel !== undefined,
  });

  const { box, band } = plot;
  const y = plot.value.position;
  const items = levels.map((level) => ({ id: level.step.id, label: level.step.label }));

  function start(id: string): number {
    return band.start(id) ?? box.left;
  }

  function center(id: string): number {
    return start(id) + band.bandwidth * HALF;
  }

  const byPriority = [
    ...levels.filter((level) => level.step.kind !== 'change'),
    ...levels.filter((level) => level.step.kind === 'change'),
  ];

  const valueLabels = clearLabels(
    byPriority.map((level) => ({
      id: level.step.id,
      isTotal: level.step.kind !== 'change',
      text: columnText({ level, valueText, changeText }),
      x: center(level.step.id),
      y: columnBox(level, y, box.bottom).labelY,
    })),
  );

  return (
    <Chart
      items={items}
      readout={(id) => inspectionReadout(reading(id))}
      locate={(point) => band.idAt((point.x / point.width) * box.width)}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => {
        const active = reading(inspected);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            titleDetail={active.level === undefined ? undefined : `${active.label} · ${active.summary}`}
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
                    levelText({ level, valueText, changeText }),
                    level.step.kind === 'change'
                      ? runningText({ level, valueText })
                      : levelText({ level, valueText, changeText }),
                  ],
                })),
                ...referenceLines.map((line) => ({
                  id: `reference:${line.id}`,
                  values: [line.label, valueText(line.value), ''],
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
              x={center(inspected ?? '')}
              width={size.width}
              offset={band.bandwidth * HALF + INSPECTOR_OFFSET}
            />
            {levels.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <PlotSurface
                plotRef={size.ref}
                box={box}
                label={plotLabel({ title, marks: 'steps', isSelectable: onSelectedChange !== undefined })}
                readoutId={inspectionId}
              >
                <PlotAxes box={box} xTicks={plot.bandTicks} yTicks={plot.valueTicks} yTitle={valueLabel} />
                <PlotClip box={box}>
                  {levels.map((level, index) => {
                    const next = levels[index + 1];

                    if (next === undefined || level.to === null || next.from === null) {
                      return null;
                    }

                    return (
                      <ConnectorMark
                        key={`connector:${level.step.id}`}
                        x1={start(level.step.id) + band.bandwidth}
                        x2={start(next.step.id)}
                        y1={y(level.to)}
                        y2={y(level.to)}
                      />
                    );
                  })}
                  {levels.map((level) => {
                    const column = columnBox(level, y, box.bottom);

                    return (
                      <BarMark
                        key={level.step.id}
                        x={start(level.step.id)}
                        y={column.top}
                        width={band.bandwidth}
                        height={column.height}
                        tone={column.isKnown ? level.tone : 'neutral'}
                        isHollow={!column.isKnown}
                        isSelected={selected === level.step.id}
                        isInspected={inspected === level.step.id}
                      />
                    );
                  })}
                  <RuleMark x1={box.left} x2={box.right} y1={y(0)} y2={y(0)} />
                </PlotClip>
                <ReferenceMarks
                  lines={referenceLines}
                  box={box}
                  position={y}
                  valueText={valueText}
                  avoid={valueLabels}
                  marks={levels.map((level) => {
                    const column = columnBox(level, y, box.bottom);

                    return {
                      left: start(level.step.id),
                      right: start(level.step.id) + band.bandwidth,
                      top: column.top,
                      bottom: column.top + column.height,
                    };
                  })}
                />
                <g aria-hidden>
                  {valueLabels.map((label) => (
                    <LabelMark key={label.id} x={label.x} y={label.y} anchor="middle" isStrong={label.isTotal}>
                      {label.text}
                    </LabelMark>
                  ))}
                </g>
                {cursor !== null && (
                  <ChartCursor
                    x={center(cursor)}
                    top={box.top}
                    bottom={box.bottom}
                    width={Math.max(CURSOR_MIN, band.bandwidth)}
                  />
                )}
              </PlotSurface>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}

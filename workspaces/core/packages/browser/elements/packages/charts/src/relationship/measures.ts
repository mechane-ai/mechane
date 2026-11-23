import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import type { ChartLegendItem } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { fitDomain } from '../plot/plot-layout.ts';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain, ScaleType } from '../plot/scale.ts';

/** One measure the rows of a multi-measure chart are compared on. */
export type MeasureDimension = {
  readonly id: string;
  /** The measure's name with its unit: "Latency (ms)". */
  readonly label: string;
  readonly format: ValueFormat;
  /** The values the measure spans. Leave it out to fit the supplied values on round bounds. */
  readonly domain?: NumericDomain | undefined;
  readonly scale?: ScaleType | undefined;
};

/** One thing measured, such as a model or a run, with a value for each measure. A null value was not recorded. */
export type MeasureRow = {
  readonly id: string;
  readonly label: string;
  /** The id of the group the row belongs to. Groups give rows their hue. */
  readonly group?: string | undefined;
  readonly values: Readonly<Record<string, number | null>>;
};

/** A named set of rows. Its hue names the set in every mark and in the legend. */
export type MeasureGroup = { readonly id: string; readonly label: string; readonly tone?: ChartTone | undefined };

/** A measure with the domain the chart resolved for it. */
export type MeasureAxis = MeasureDimension & { readonly domain: NumericDomain };

export type MeasureLimits = { readonly dimensions: number; readonly rows: number };

const DIMENSIONS_MIN = 2;

/** The value a row holds for a measure, or null where none was recorded. */
export function measureValue(row: MeasureRow, dimension: Pick<MeasureDimension, 'id'>): number | null {
  return row.values[dimension.id] ?? null;
}

/** Gives every measure its domain: the declared one, or one fitted to the rows' values. */
export function resolveMeasureAxes({
  dimensions,
  rows,
}: {
  readonly dimensions: ReadonlyArray<MeasureDimension>;
  readonly rows: ReadonlyArray<MeasureRow>;
}): ReadonlyArray<MeasureAxis> {
  return dimensions.map((dimension) => ({
    ...dimension,
    domain:
      dimension.domain ??
      fitDomain({ values: rows.map((row) => measureValue(row, dimension)), scale: dimension.scale }),
  }));
}

/** The first reason rows cannot be drawn on these measures, or undefined. Nothing is clamped, dropped or reordered. */
export function measureInputError({
  axes,
  rows,
  groups,
  limits,
}: {
  readonly axes: ReadonlyArray<MeasureAxis>;
  readonly rows: ReadonlyArray<MeasureRow>;
  readonly groups: ReadonlyArray<MeasureGroup>;
  readonly limits: MeasureLimits;
}): string | undefined {
  if (axes.length < DIMENSIONS_MIN || axes.length > limits.dimensions) {
    return `This chart needs ${DIMENSIONS_MIN} to ${limits.dimensions} dimensions.`;
  }

  if (rows.length > limits.rows) {
    return `This chart draws at most ${limits.rows} rows. Supply a sample or a smaller set.`;
  }

  if (!hasUniqueIds(axes) || !hasUniqueIds(rows) || !hasUniqueIds(groups)) {
    return 'Dimensions, rows and groups must have unique identifiers.';
  }

  const domainError = axes
    .map((axis) => scaleDomainError(axis.domain, axis.scale))
    .find((error) => error !== undefined);

  if (domainError !== undefined) {
    return domainError;
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const unknownGroup = rows.find((row) => row.group !== undefined && !groupIds.has(row.group));

  if (unknownGroup !== undefined) {
    return `Row ${unknownGroup.id} names a group that was not supplied.`;
  }

  const outside = rows
    .flatMap((row) => axes.map((axis) => ({ row, axis, value: measureValue(row, axis) })))
    .find(({ axis, value }) => value !== null && outsideDomain(value, axis.domain));

  if (outside !== undefined) {
    return `Row ${outside.row.id} has a ${outside.axis.label} value that is not finite or lies outside the declared domain.`;
  }

  return undefined;
}

/** The exact values of a row as one sentence, with the measures it lacks named and what that leaves out. */
function measureSentence({
  row,
  axes,
  locale,
  groupLabel,
  consequence,
}: {
  readonly row: MeasureRow;
  readonly axes: ReadonlyArray<MeasureAxis>;
  readonly locale: string;
  readonly groupLabel: string | undefined;
  /** What a missing value leaves out, in the chart's words: "not drawn in panels that use them". */
  readonly consequence: string;
}): string {
  const values = axes.map(
    (axis) => `${axis.label}: ${formatValue({ value: measureValue(row, axis), locale, format: axis.format })}`,
  );

  const missing = axes.filter((axis) => measureValue(row, axis) === null).map((axis) => axis.label);
  const note = missing.length === 0 ? [] : [`No value for ${missing.join(', ')}: ${consequence}`];

  return [groupLabel === undefined ? row.label : `${row.label} (${groupLabel})`, ...values, ...note].join(' · ');
}

/** One chart item per row, in supplied order: its id and the sentence of its exact values. */
export function measureItems({
  rows,
  axes,
  locale,
  groupLabel,
  consequence,
}: {
  readonly rows: ReadonlyArray<MeasureRow>;
  readonly axes: ReadonlyArray<MeasureAxis>;
  readonly locale: string;
  readonly groupLabel: (row: MeasureRow) => string | undefined;
  readonly consequence: string;
}): ReadonlyArray<{ readonly id: string; readonly label: string }> {
  return rows.map((row) => ({
    id: row.id,
    label: measureSentence({ row, axes, locale, groupLabel: groupLabel(row), consequence }),
  }));
}

/** The columns and rows of the hidden table that gives a screen reader every exact value. */
export function measureTable({
  rows,
  axes,
  locale,
}: {
  readonly rows: ReadonlyArray<MeasureRow>;
  readonly axes: ReadonlyArray<MeasureAxis>;
  readonly locale: string;
}): {
  readonly columns: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly rows: ReadonlyArray<{ readonly id: string; readonly values: ReadonlyArray<string> }>;
} {
  return {
    columns: [{ id: 'row', label: 'Row' }, ...axes.map((axis) => ({ id: axis.id, label: axis.label }))],
    rows: rows.map((row) => ({
      id: row.id,
      values: [
        row.label,
        ...axes.map((axis) => formatValue({ value: measureValue(row, axis), locale, format: axis.format })),
      ],
    })),
  };
}

/**
 * The hue of each row and the legend that names them. Rows take their group's hue; with groups supplied, a row without
 * one is gray, and with none every row shares the first hue.
 */
export function useMeasureTones(groups: ReadonlyArray<MeasureGroup>): {
  readonly toneOf: (row: MeasureRow) => ChartTone;
  readonly groupLabel: (row: MeasureRow) => string | undefined;
  readonly legend: ReadonlyArray<ChartLegendItem>;
} {
  const tones = useTones();

  const legend = groups.map((group, index) => ({
    id: group.id,
    label: group.label,
    tone: tones({ id: group.id, tone: group.tone, index }),
  }));

  const fallback: ChartTone = groups.length === 0 ? 'series1' : 'neutral';

  return {
    toneOf: (row) => legend.find((item) => item.id === row.group)?.tone ?? fallback,
    groupLabel: (row) => legend.find((item) => item.id === row.group)?.label,
    legend,
  };
}

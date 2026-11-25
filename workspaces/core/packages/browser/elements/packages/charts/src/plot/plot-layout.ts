import { formatTime, formatValue, tickFormat, zoneOffset } from '../figure/figure-format.ts';
import type { TimeFormat, ValueFormat } from '../figure/figure-format.ts';
import { bandScale, continuousScale } from './scale.ts';
import type { BandScale, ContinuousScale, NumericDomain, ScaleType } from './scale.ts';
import { linearTicks, scaleTicks, timeTicks } from './ticks.ts';

/** The named plot heights, in CSS pixels. A figure picks one, so charts side by side share a baseline. */
export const plotHeights = { compact: 160, regular: 260, tall: 380 } as const;

export type PlotHeight = keyof typeof plotHeights;

export type PlotMargins = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** The drawing area inside the axes, in the CSS pixels of the plot's own top left corner. */
export type PlotBox = {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
};

/** One labelled position on an axis. A category label wrapped by `categoryPlot` holds one line break. */
export type PlotTick = { readonly key: string; readonly position: number; readonly label: string };

/** A measured axis as a chart's caller declares it. */
export type PlotAxis = {
  /** The axis title, with its unit: "Latency (ms)". */
  readonly label: string;
  /** The values the axis spans. Leave it out to fit the supplied values on round bounds. */
  readonly domain?: NumericDomain | undefined;
  readonly scale?: ScaleType | undefined;
  /** How readouts and tables write a value on this axis. Ticks use its compact form unless `tickFormat` is set. */
  readonly format: ValueFormat;
  readonly tickFormat?: ValueFormat | undefined;
};

export type PlotCategory = { readonly id: string; readonly label: string };

const CHARACTER_WIDTH = 7;
const TICK_GAP = 12;
const MIN_LEFT = 44;
const TITLE_BAND = 20;
/** The side title's band: its glyphs and a clear gap before the longest tick label. */
const SIDE_TITLE_BAND = 28;
const TICK_BAND = 24;
const TOP_MARGIN = 12;
const RIGHT_MARGIN = 20;
const LEFT_MAX_SHARE = 0.4;
/** Row names may take half the width: a narrow plot keeps its labels whole for longer, and cuts them only then. */
const ROWS_LEFT_MAX_SHARE = 0.5;
const TICKS_MIN = 2;
const TICKS_MIN_LONG = 3;
const AXIS_TICKS_FROM = 120;
const TICK_ATTEMPTS = 6;
/** The share of the usual tick spacing below which more ticks would crowd the axis. */
const TICK_CROWDING = 0.4;
/** The most digits after the point a tick may gain, one at a time, until no two ticks read the same. */
const TICK_DIGITS_MAX = 4;
const precisionSteps = Array.from({ length: TICK_DIGITS_MAX }, (_, index) => index + 1);
const DECADE = 10;
const X_TICK_SPACING = 96;
const Y_TICK_SPACING = 56;
const FIT_TICKS = 3;
const BAND_PADDING = 0.2;
const LABEL_GAP = 16;
/** The distance from one line of a wrapped tick label to the next. */
const LINE_STEP = 14;
const LINE_BREAK = '\n';

const scaleNames: Readonly<Record<ScaleType, string | undefined>> = {
  linear: undefined,
  log: 'log scale',
  symlog: 'symmetric log scale',
};

/** The axis title a reader sees. A log axis always says so, because equal distances no longer mean equal amounts. */
export function axisTitle(axis: Pick<PlotAxis, 'label' | 'scale'>): string {
  const name = scaleNames[axis.scale ?? 'linear'];

  return name === undefined ? axis.label : `${axis.label} (${name})`;
}

export type FitDomainInput = {
  readonly values: ReadonlyArray<number | null>;
  /** True for marks whose length carries the amount, such as bars: their axis always starts at zero. */
  readonly isZeroBased?: boolean | undefined;
  readonly scale?: ScaleType | undefined;
};

/**
 * The domain a chart uses when its caller declares none: the finite values, widened to round bounds. A linear axis with
 * no spread gets one unit on each side; a log axis rounds out to powers of ten.
 */
export function fitDomain({ values, isZeroBased = false, scale = 'linear' }: FitDomainInput): NumericDomain {
  const finite = values.flatMap((value) => (value !== null && Number.isFinite(value) ? [value] : []));
  const observed = isZeroBased && scale !== 'log' ? [...finite, 0] : finite;

  if (observed.length === 0) {
    return scale === 'log' ? [1, DECADE] : [0, 1];
  }

  const low = Math.min(...observed);
  const high = Math.max(...observed);

  if (scale === 'log') {
    const floor = DECADE ** Math.floor(Math.log10(Math.max(low, Number.MIN_VALUE)));
    const ceiling = DECADE ** Math.ceil(Math.log10(Math.max(high, Number.MIN_VALUE)));

    return [floor, ceiling > floor ? ceiling : floor * DECADE];
  }

  if (low === high) {
    return [low - 1, high + 1];
  }

  if (scale === 'symlog') {
    return [low, high];
  }

  const [first, second] = linearTicks([low, high], FIT_TICKS);
  const step = first === undefined || second === undefined ? high - low : second - first;

  return [Math.floor(low / step) * step, Math.ceil(high / step) * step];
}

/** The margins that hold a plot's tick labels and axis titles. The left one grows with the longest value label. */
export function plotMargins({
  width,
  valueLabels,
  hasXTitle,
  hasYTitle,
  leftShare = LEFT_MAX_SHARE,
}: {
  readonly width: number;
  /** The labels drawn beside the vertical axis. */
  readonly valueLabels: ReadonlyArray<string>;
  readonly hasXTitle: boolean;
  readonly hasYTitle: boolean;
  /** The largest share of the width the left margin may take. Rows of named categories may take more than values. */
  readonly leftShare?: number | undefined;
}): PlotMargins {
  const longest = Math.max(0, ...valueLabels.map((label) => label.length));
  const labels = longest * CHARACTER_WIDTH + TICK_GAP + (hasYTitle ? SIDE_TITLE_BAND : 0);

  return {
    top: TOP_MARGIN,
    right: RIGHT_MARGIN,
    bottom: TICK_BAND + (hasXTitle ? TITLE_BAND : 0),
    left: Math.min(Math.max(MIN_LEFT, labels), width * leftShare),
  };
}

export function plotBox({
  width,
  height,
  margins,
}: {
  readonly width: number;
  readonly height: number;
  readonly margins: PlotMargins;
}): PlotBox {
  const right = Math.max(margins.left, width - margins.right);
  const bottom = Math.max(margins.top, height - margins.bottom);

  return {
    width,
    height,
    left: margins.left,
    right,
    top: margins.top,
    bottom,
    innerWidth: right - margins.left,
    innerHeight: bottom - margins.top,
  };
}

/** Tick values with the text each one shows. */
export type AxisTicks = { readonly values: ReadonlyArray<number>; readonly labels: ReadonlyArray<string> };

export type AxisTicksInput = {
  readonly axis: PlotAxis;
  readonly domain: NumericDomain;
  /** The axis length in pixels: the plot's height for a vertical axis, its inner width for a horizontal one. */
  readonly length: number;
  /** About how many pixels apart neighbouring ticks sit. */
  readonly spacing: number;
  readonly locale: string;
  /**
   * True when the axis draws its title. The title names the unit, so the ticks leave out a `unit` style and stay short;
   * currency and percent signs remain.
   */
  readonly hasTitle: boolean;
};

/** Whether no two labels of an axis read the same. */
function isDistinct(labels: ReadonlyArray<string>): boolean {
  return new Set(labels).size === labels.length;
}

/** The same format with more digits after the point, and no significant-digit cap that would override them. */
function morePrecise(format: Intl.NumberFormatOptions, digits: number): Intl.NumberFormatOptions {
  return {
    ...format,
    minimumSignificantDigits: undefined,
    maximumSignificantDigits: undefined,
    minimumFractionDigits: Math.min(format.minimumFractionDigits ?? 0, digits),
    maximumFractionDigits: Math.max(format.maximumFractionDigits ?? 0, digits),
  };
}

/** A tick format without the unit, for an axis whose title already names it. */
function unitless(format: ValueFormat, hasTitle: boolean): ValueFormat {
  if (!hasTitle || typeof format === 'function' || format.style !== 'unit') {
    return format;
  }

  return { ...format, style: 'decimal', unit: undefined, unitDisplay: undefined };
}

/**
 * The text of each tick, raised in precision until no two read the same. The order is the compact form, then the
 * compact form with one to four digits after the point, then the full form with as many. A function format is used as
 * supplied.
 */
export function tickTexts({
  values,
  axis,
  locale,
  hasTitle,
}: Pick<AxisTicksInput, 'axis' | 'locale' | 'hasTitle'> & {
  readonly values: ReadonlyArray<number>;
}): ReadonlyArray<string> {
  const supplied = unitless(axis.tickFormat ?? tickFormat(axis.format), hasTitle);
  const full = unitless(axis.format, hasTitle);

  const ladder: ReadonlyArray<ValueFormat> =
    typeof supplied === 'function'
      ? [supplied]
      : [
          supplied,
          ...precisionSteps.map((digits) => morePrecise(supplied, digits)),
          ...(typeof full === 'function' ? [] : precisionSteps.map((digits) => morePrecise(full, digits))),
        ];

  const attempts = ladder.map((format) => values.map((value) => formatValue({ value, locale, format })));

  return attempts.find(isDistinct) ?? attempts.at(-1) ?? [];
}

/**
 * The fewest ticks an axis of this length shows: three once it is longer than 120 pixels, two below. Charts that place
 * their own ticks use it, so every axis agrees.
 */
export function ticksMinimum(length: number): number {
  return length > AXIS_TICKS_FROM ? TICKS_MIN_LONG : TICKS_MIN;
}

/**
 * The ticks of a measured axis: round values on its scale, at least three on an axis longer than 120 pixels, each
 * labelled so that no two read the same. Ticks that land on both ends of the domain win when they fit, so the lowest
 * and highest marks never sit beyond the outer ticks. Every kernel layout labels its axes with it; a chart that draws
 * an axis of its own calls it too.
 */
function wantsIntegerTicks(axis: PlotAxis): boolean {
  const fmt = axis.tickFormat ?? axis.format;

  if (typeof fmt === 'function' || axis.scale === 'log') {
    return false;
  }

  return fmt.maximumFractionDigits === 0 && fmt.style !== 'percent';
}

export function axisTicks({ axis, domain, length, spacing, locale, hasTitle }: AxisTicksInput): AxisTicks {
  const minimum = ticksMinimum(length);
  const count = Math.max(minimum, Math.round(length / spacing));

  const attempts = Array.from({ length: TICK_ATTEMPTS }, (_, index) =>
    scaleTicks({ domain, type: axis.scale, count: count + index }),
  ).filter((ticks, index) => index === 0 || ticks.length * spacing * TICK_CROWDING <= length);

  const enough = attempts.filter((ticks) => ticks.length >= minimum);

  const spanning = enough.find((ticks) => ticks[0] === domain[0] && ticks.at(-1) === domain[1]);
  const fallback = enough[0] ?? attempts[0] ?? [];
  const rawValues = spanning ?? fallback;

  if (wantsIntegerTicks(axis)) {
    const ints = rawValues.filter((value) => Number.isInteger(value));
    const values = ints.length >= TICKS_MIN ? ints : rawValues;

    return { values, labels: tickTexts({ values, axis, locale, hasTitle }) };
  }

  return { values: rawValues, labels: tickTexts({ values: rawValues, axis, locale, hasTitle }) };
}

function positioned(scale: ContinuousScale, ticks: AxisTicks): ReadonlyArray<PlotTick> {
  return ticks.values.map((value, index) => ({
    key: String(value),
    position: scale.position(value),
    label: ticks.labels[index] ?? '',
  }));
}

/**
 * A label broken at the space that best balances its two lines, so a long category name under a column can wrap instead
 * of being dropped. A label without a space stays on one line.
 */
function twoLines(label: string): string {
  const words = label.split(' ');

  const splits = words.slice(1).map((_, index) => {
    const first = words.slice(0, index + 1).join(' ');
    const second = words.slice(index + 1).join(' ');

    return { text: `${first}${LINE_BREAK}${second}`, longest: Math.max(first.length, second.length) };
  });

  return splits.toSorted((first, second) => first.longest - second.longest)[0]?.text ?? label;
}

/**
 * The ticks of a band axis: one at the center of each category, labelled with its name. A label may hold a line break,
 * which `PlotAxes` draws as a second line.
 */
export function bandTicks(scale: BandScale, categories: ReadonlyArray<PlotCategory>): ReadonlyArray<PlotTick> {
  return categories.flatMap((category) => {
    const position = scale.center(category.id);

    return position === undefined ? [] : [{ key: category.id, position, label: category.label }];
  });
}

export type NumericPlotLayout = {
  readonly box: PlotBox;
  readonly x: ContinuousScale;
  readonly y: ContinuousScale;
  readonly xTicks: ReadonlyArray<PlotTick>;
  readonly yTicks: ReadonlyArray<PlotTick>;
};

/** The layout of a plot with a measured axis on both sides: margins from the tick labels, then scales and ticks. */
export function numericPlot({
  width,
  height,
  x,
  y,
  xDomain,
  yDomain,
  locale,
  rightGutter = 0,
}: {
  readonly width: number;
  readonly height: number;
  readonly x: PlotAxis;
  readonly y: PlotAxis;
  /** The resolved domains: the caller's own, or the result of `fitDomain`. */
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
  readonly locale: string;
  /** Extra room right of the plot, in pixels, for labels at the end of lines. */
  readonly rightGutter?: number | undefined;
}): NumericPlotLayout {
  const yLabels = axisTicks({
    axis: y,
    domain: yDomain,
    length: height,
    spacing: Y_TICK_SPACING,
    locale,
    hasTitle: true,
  });

  const fitted = plotMargins({ width, valueLabels: yLabels.labels, hasXTitle: true, hasYTitle: true });
  const margins = { ...fitted, right: fitted.right + rightGutter };
  const box = plotBox({ width, height, margins });

  const xLabels = axisTicks({
    axis: x,
    domain: xDomain,
    length: box.innerWidth,
    spacing: X_TICK_SPACING,
    locale,
    hasTitle: true,
  });

  const xScale = continuousScale({ type: x.scale, domain: xDomain, range: [box.left, box.right] });
  const yScale = continuousScale({ type: y.scale, domain: yDomain, range: [box.bottom, box.top] });

  return { box, x: xScale, y: yScale, xTicks: positioned(xScale, xLabels), yTicks: positioned(yScale, yLabels) };
}

export type CategoryPlotLayout = {
  readonly box: PlotBox;
  readonly band: BandScale;
  readonly value: ContinuousScale;
  readonly bandTicks: ReadonlyArray<PlotTick>;
  readonly valueTicks: ReadonlyArray<PlotTick>;
};

/**
 * The layout of a plot with named categories on one axis and a measured value on the other. The `columns` direction
 * stands the categories along the bottom. The `rows` direction lists them down the side, which suits long names.
 */
export function categoryPlot({
  width,
  height,
  direction,
  categories,
  value,
  valueDomain,
  locale,
  padding = BAND_PADDING,
  topInset = 0,
  rightGutter = 0,
  hasValueTitle = true,
}: {
  readonly width: number;
  readonly height: number;
  readonly direction: 'columns' | 'rows';
  readonly categories: ReadonlyArray<PlotCategory>;
  readonly value: PlotAxis;
  readonly valueDomain: NumericDomain;
  readonly locale: string;
  readonly padding?: number | undefined;
  /** Extra room above the plot, in pixels, for notes drawn over the tallest marks. */
  readonly topInset?: number | undefined;
  /** Extra room right of the plot, in pixels, for labels at the end of reference lines. */
  readonly rightGutter?: number | undefined;
  /** False when the value axis draws no title, so its margin holds only the tick labels. */
  readonly hasValueTitle?: boolean | undefined;
}): CategoryPlotLayout {
  const ids = categories.map((category) => category.id);
  const isColumns = direction === 'columns';

  const labels = axisTicks({
    axis: value,
    domain: valueDomain,
    length: isColumns ? height : width,
    spacing: isColumns ? Y_TICK_SPACING : X_TICK_SPACING,
    locale,
    hasTitle: hasValueTitle,
  });

  const sideLabels = isColumns ? labels.labels : categories.map((category) => category.label);

  const fitted = plotMargins({
    width,
    valueLabels: sideLabels,
    hasXTitle: !isColumns && hasValueTitle,
    hasYTitle: isColumns && hasValueTitle,
    leftShare: isColumns ? LEFT_MAX_SHARE : ROWS_LEFT_MAX_SHARE,
  });

  const margins = { ...fitted, top: fitted.top + topInset, right: fitted.right + rightGutter };
  const firstBox = plotBox({ width, height, margins });
  const room = bandScale({ ids, range: [firstBox.left, firstBox.right], padding }).step - LABEL_GAP;
  const isCrowded = categories.some((category) => category.label.length * CHARACTER_WIDTH > room);
  const wrapped = categories.map((category) => ({ ...category, label: twoLines(category.label) }));

  const isWrapped =
    isColumns &&
    isCrowded &&
    wrapped.every((category) =>
      category.label.split(LINE_BREAK).every((line) => line.length * CHARACTER_WIDTH <= room),
    );

  const box = isWrapped
    ? plotBox({ width, height, margins: { ...margins, bottom: margins.bottom + LINE_STEP } })
    : firstBox;

  const band = bandScale({ ids, range: isColumns ? [box.left, box.right] : [box.top, box.bottom], padding });

  const scale = continuousScale({
    type: value.scale,
    domain: valueDomain,
    range: isColumns ? [box.bottom, box.top] : [box.left, box.right],
  });

  return {
    box,
    band,
    value: scale,
    bandTicks: bandTicks(band, isWrapped ? wrapped : categories),
    valueTicks: positioned(scale, labels),
  };
}

export type ValueGutterInput = {
  readonly height: number;
  /** The value axis of each plot that shares the gutter, with its resolved domain. */
  readonly axes: ReadonlyArray<{ readonly axis: PlotAxis; readonly domain: NumericDomain }>;
  readonly locale: string;
  /** True when the plots draw their value-axis titles, as `timePlot` does with `hasValueTitle`. */
  readonly hasValueTitle?: boolean | undefined;
};

/**
 * The left margin that holds the value tick labels of every listed plot. Plots stacked in a column, such as small
 * multiples, pass it to `timePlot` so their value axes line up on one gutter.
 */
export function valueGutter({ height, axes, locale, hasValueTitle = false }: ValueGutterInput): number {
  const labels = axes.flatMap(
    ({ axis, domain }) =>
      axisTicks({ axis, domain, length: height, spacing: Y_TICK_SPACING, locale, hasTitle: hasValueTitle }).labels,
  );

  return plotMargins({
    width: Number.POSITIVE_INFINITY,
    valueLabels: labels,
    hasXTitle: false,
    hasYTitle: hasValueTitle,
  }).left;
}

export type TimePlotInput = {
  readonly width: number;
  readonly height: number;
  readonly value: PlotAxis;
  readonly valueDomain: NumericDomain;
  /** The first and last instant the plot spans, in milliseconds since the epoch. */
  readonly timeDomain: NumericDomain;
  /** How the time axis writes its ticks. A format with a time zone puts the ticks on that zone's clock steps. */
  readonly timeFormat: TimeFormat;
  readonly locale: string;
  /** Extra room above the plot, in pixels, for labels drawn along its top edge. */
  readonly topInset?: number | undefined;
  /** A left margin shared with other plots, from `valueGutter`. The plot never takes less. */
  readonly gutter?: number | undefined;
  /** True when the plot draws its value-axis title, so the margin holds it and the ticks leave the unit to it. */
  readonly hasValueTitle?: boolean | undefined;
};

/**
 * The layout of a plot of values over time: elapsed time along the bottom, on round clock steps, and a measured value
 * up the side. Its scales and ticks match `numericPlot`, so a time series and a curve placed side by side read alike.
 */
export function timePlot({
  width,
  height,
  value,
  valueDomain,
  timeDomain,
  timeFormat,
  locale,
  topInset = 0,
  gutter = 0,
  hasValueTitle = false,
}: TimePlotInput): NumericPlotLayout {
  const yLabels = axisTicks({
    axis: value,
    domain: valueDomain,
    length: height,
    spacing: Y_TICK_SPACING,
    locale,
    hasTitle: hasValueTitle,
  });

  const fitted = plotMargins({ width, valueLabels: yLabels.labels, hasXTitle: false, hasYTitle: hasValueTitle });
  const left = Math.min(Math.max(fitted.left, gutter), width * LEFT_MAX_SHARE);
  const box = plotBox({ width, height, margins: { ...fitted, top: fitted.top + topInset, left } });
  const xScale = continuousScale({ domain: timeDomain, range: [box.left, box.right] });
  const yScale = continuousScale({ type: value.scale, domain: valueDomain, range: [box.bottom, box.top] });
  const xTicks = positioned(xScale, timeAxisTicks({ domain: timeDomain, length: box.innerWidth, timeFormat, locale }));

  return { box, x: xScale, y: yScale, xTicks, yTicks: positioned(yScale, yLabels) };
}

export type TimeAxisTicksInput = {
  /** The first and last instant, in milliseconds since the epoch. */
  readonly domain: NumericDomain;
  /** The axis length in pixels. */
  readonly length: number;
  readonly timeFormat: TimeFormat;
  readonly locale: string;
  /** The zone whose clock steps the ticks land on, for a function format. Options formats name their own zone. */
  readonly timeZone?: string | undefined;
};

/** The date fields a time tick gains, in order, when its format alone would write two ticks alike. */
const timeDetail: ReadonlyArray<Intl.DateTimeFormatOptions> = [
  { month: 'short', day: 'numeric' },
  { year: 'numeric', month: 'short', day: 'numeric' },
  { year: 'numeric', month: 'short', day: 'numeric', second: '2-digit' },
];

/**
 * The ticks of a time axis: instants on round clock steps in the format's zone, at least three on an axis longer than
 * 120 pixels. When two ticks would read alike, such as two midnights written "00:00", the labels gain the date, then
 * the year, then seconds. Fields the format sets itself stay as it sets them, and a function format is used as
 * supplied.
 */
export function timeAxisTicks({ domain, length, timeFormat, locale, timeZone }: TimeAxisTicksInput): AxisTicks {
  const zone = typeof timeFormat === 'function' ? timeZone : timeFormat.timeZone;
  const offset = zone === undefined ? 0 : zoneOffset(domain[0], zone);
  const minimum = ticksMinimum(length);
  const count = Math.max(minimum, Math.round(length / X_TICK_SPACING));

  const attempts = Array.from({ length: TICK_ATTEMPTS }, (_, index) =>
    timeTicks({ domain, count: count + index, zoneOffset: offset }),
  );

  const values = attempts.find((ticks) => ticks.length >= minimum) ?? attempts[0] ?? [];

  const ladder: ReadonlyArray<TimeFormat> =
    typeof timeFormat === 'function'
      ? [timeFormat]
      : [timeFormat, ...timeDetail.map((detail) => ({ ...detail, ...timeFormat }))];

  const texts = ladder.map((format) => values.map((timestamp) => formatTime({ timestamp, locale, format })));

  return { values, labels: texts.find(isDistinct) ?? texts.at(-1) ?? [] };
}

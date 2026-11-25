import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { usePlotWidth } from '../plot-width.ts';
import { isFiniteDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/** Which edge of its cell the exact value hugs. Numbers read best at the end, where the digits line up. */
export type CellAlign = 'start' | 'end';

/**
 * What every table cell graphic takes, with the value always written beside the graphic so the graphic is never the
 * only carrier of the number. A cell takes a declared `format` and an explicit `locale`, as contract 072 allows for
 * shared display components, rather than already formatted text. One pattern keeps the missing text, the signs and the
 * units the same in all five cells, and the props stay plain data that a figure spec can name.
 */
export type CellProps = {
  /** The locale of every number in the cell. It is an input, so a server and a browser render alike. */
  readonly locale: string;
  /** How the value is written. The same format is used in every row of a column. */
  readonly format: ValueFormat;
  /** Which edge of the cell the text hugs. Defaults to the end. */
  readonly align?: CellAlign | undefined;
  /**
   * The width kept for the text, in characters. Rows of one column should keep the same width, so graphics start at the
   * same place and share one scale by eye. Each cell has a default that fits its usual text.
   */
  readonly textWidth?: number | undefined;
};

/**
 * What a cell needs to be drawn on its column's scale. A cell cannot see its column, so the application passes the same
 * `domain` to every row. A value outside it is refused, never clamped.
 */
export type CellDomainProps = { readonly domain: NumericDomain };

/** The hue of a cell's mark. */
export type CellToneProps = {
  /** The thing this row shows, such as a model. With a tone scope, one thing keeps one hue across figures and cells. */
  readonly id?: string | undefined;
  /** Sets the hue directly, beating the scope. Absent takes the scope's hue for `id`, then the first series hue. */
  readonly tone?: ChartTone | undefined;
};

type CellState = 'value' | 'missing' | 'invalid';

const CELL_HEIGHT = 16;
const GRAPHIC_WIDTH_MIN = 24;

const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  track: {
    position: 'relative',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: GRAPHIC_WIDTH_MIN,
    height: CELL_HEIGHT,
    overflow: 'hidden',
  },
  svg: { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, display: 'block' },
  text: { flexShrink: 0, whiteSpace: 'nowrap' },
  width: (characters: number) => ({ minWidth: `${characters}ch` }),
  filled: (color: string) => ({
    flexGrow: 1,
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    paddingBlock: spacing.sm,
    paddingInline: spacing.sm,
    borderRadius: 0,
    backgroundColor: color,
  }),
});

const directions = stylex.create({ start: { flexDirection: 'row-reverse' }, end: { flexDirection: 'row' } });

const textAlignments = stylex.create({ start: { textAlign: 'start' }, end: { textAlign: 'end' } });

const states = stylex.create({ value: {}, missing: { color: colors.muted }, invalid: { color: colors.danger } });

const TEXT_WIDTH_DEFAULT = 8;

export type CellLayoutProps = {
  readonly align?: CellAlign | undefined;
  readonly textWidth?: number | undefined;
  /** The graphic beside the text, built with `CellGraphic`. Absent draws text only. */
  readonly graphic?: ReactNode;
  /** `missing` and `invalid` mute or flag the text. */
  readonly state?: CellState | undefined;
  /** The reason for an invalid cell, shown on hover. */
  readonly title?: string | undefined;
  /** Fills the text's box with this color, as a heat cell does. The text stays ink, so the color must stay legible. */
  readonly background?: string | undefined;
  /** The exact value as text. */
  readonly children: ReactNode;
};

/**
 * One text line: a graphic and the exact value beside it, in tabular numerals. The graphic is hidden from assistive
 * tech.
 */
export function CellLayout({
  align = 'end',
  textWidth = TEXT_WIDTH_DEFAULT,
  graphic,
  state = 'value',
  title,
  background,
  children,
}: CellLayoutProps): ReactNode {
  return (
    <div {...stylex.props(styles.root, directions[align])}>
      {graphic}
      <span
        title={title}
        {...stylex.props(
          styles.text,
          styles.width(textWidth),
          textAlignments[align],
          states[state],
          background !== undefined && styles.filled(background),
        )}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * The fluid drawing area of a cell: one line tall, as wide as the cell leaves it. It measures itself and hands the
 * pixel width to `children`, which returns the marks.
 */
export function CellGraphic({ children }: { readonly children: (width: number) => ReactNode }): ReactNode {
  const { ref, width } = usePlotWidth();

  return (
    <div ref={ref} aria-hidden {...stylex.props(styles.track)}>
      <svg width={width} height={CELL_HEIGHT} viewBox={`0 0 ${width} ${CELL_HEIGHT}`} {...stylex.props(styles.svg)}>
        {children(width)}
      </svg>
    </div>
  );
}

/** The height of the drawing area, for marks that center on the line. */
export const cellHeight = CELL_HEIGHT;

/** Why the column domain or a value cannot be drawn, or undefined when all can. Missing (null) values are allowed. */
export function cellProblem({
  domain,
  values,
}: {
  /** The column domain. Absent for a cell with no scale, which then only needs finite values. */
  readonly domain?: NumericDomain | undefined;
  readonly values: ReadonlyArray<number | null>;
}): string | undefined {
  if (domain !== undefined && !isFiniteDomain(domain)) {
    return 'The column domain must contain two finite, increasing values.';
  }

  const isOutside = values.some((value) => {
    if (value === null) {
      return false;
    }

    const isOutsideDomain = domain !== undefined && (value < domain[0] || value > domain[1]);

    return !Number.isFinite(value) || isOutsideDomain;
  });

  return isOutside ? 'Every value must be finite and inside the column domain.' : undefined;
}

/** The cell shown in place of a graphic that cannot be drawn. It names the reason on hover and never repairs input. */
export function InvalidCell({
  message,
  align,
  textWidth,
}: Pick<CellLayoutProps, 'align' | 'textWidth'> & { readonly message: string }): ReactNode {
  return (
    <CellLayout align={align} textWidth={textWidth} state="invalid" title={message}>
      Invalid value
    </CellLayout>
  );
}

/** The hue of a cell's mark: its own tone, then the tone scope's hue for its id, then the first series hue. */
export function useCellTone({ id = '', tone }: CellToneProps): ChartTone {
  return useTones()({ id, tone, index: 0 });
}

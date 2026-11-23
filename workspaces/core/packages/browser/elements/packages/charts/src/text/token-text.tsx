import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { formatValue, MISSING_VALUE_TEXT } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { tokenScaleGradient } from './token-scale.ts';
import type { TokenScale } from './token-scale.ts';

type WhitespaceKind = 'space' | 'tab' | 'newline' | 'return' | 'other';

const whitespaceKinds: Readonly<Record<string, WhitespaceKind | undefined>> = {
  ' ': 'space',
  '\t': 'tab',
  '\n': 'newline',
  '\r': 'return',
};

const whitespaceNames: Readonly<Record<string, string | undefined>> = {
  ' ': 'space',
  '\t': 'tab',
  '\n': 'newline',
  '\r': 'carriage return',
};

const escapes: Readonly<Record<string, string | undefined>> = {
  '\t': String.raw`\t`,
  '\n': String.raw`\n`,
  '\r': String.raw`\r`,
  "'": String.raw`\'`,
  '\\': String.raw`\\`,
};

const HEX = 16;
const CODE_POINT_DIGITS = 4;
const INVISIBLE = /[\s\p{Cf}]/u;
const SEGMENTS = /[\s\p{Cf}]|[^\s\p{Cf}]+/gu;

function codePoint(character: string): string {
  return (character.codePointAt(0) ?? 0).toString(HEX).toUpperCase().padStart(CODE_POINT_DIGITS, '0');
}

function escapeCharacter(character: string): string {
  const escape = escapes[character];

  if (escape !== undefined) {
    return escape;
  }

  return character !== ' ' && INVISIBLE.test(character) ? `\\u{${codePoint(character)}}` : character;
}

function whitespaceName(character: string): string {
  return whitespaceNames[character] ?? `U+${codePoint(character)}`;
}

/**
 * A token's exact text as a readout writes it: in single quotes, with a newline, tab or other invisible character
 * spelled as an escape. A token of only whitespace, or none, also says what it holds: `'\n' (newline)`.
 */
export function quoteToken(text: string): string {
  const quoted = `'${Array.from(text, escapeCharacter).join('')}'`;

  if (text.length === 0) {
    return `${quoted} (empty)`;
  }

  const characters = Array.from(text);

  return characters.every((character) => INVISIBLE.test(character))
    ? `${quoted} (${characters.map(whitespaceName).join(', ')})`
    : quoted;
}

const styles = stylex.create({
  text: { fontFamily: typography.monoFamily, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  line: { whiteSpace: 'pre' },
  space: {
    'position': 'relative',
    '::after': {
      content: '"·"',
      position: 'absolute',
      insetInline: 0,
      textAlign: 'center',
      color: colors.ink,
      opacity: 0.45,
      pointerEvents: 'none',
    },
  },
  boxed: {
    'display': 'inline-block',
    'width': '1ch',
    'height': '1lh',
    'overflow': 'hidden',
    'whiteSpace': 'pre',
    'verticalAlign': 'bottom',
    '::before': { color: colors.ink, opacity: 0.45 },
  },
  empty: { '::before': { content: '"∅"', color: colors.ink, opacity: 0.45 } },
  legend: {
    display: 'grid',
    gap: spacing.xs,
    minWidth: 0,
    maxWidth: 320,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  ramp: (image: string) => ({
    height: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundImage: image,
  }),
  bounds: { display: 'flex', justifyContent: 'space-between', gap: spacing.md, fontVariantNumeric: 'tabular-nums' },
  missing: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs },
  hollow: {
    width: 10,
    height: 10,
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: colors.muted,
  },
  frame: { overflowX: 'auto', minWidth: 0, maxWidth: '100%', overscrollBehaviorX: 'contain' },
  bounded: { overflowY: 'auto', maxHeight: '70vh' },
});

const glyphs = stylex.create({
  space: {},
  tab: { '::before': { content: '"→"' } },
  newline: { '::before': { content: '"↵"' } },
  return: { '::before': { content: '"←"' } },
  other: { '::before': { content: '"␣"' } },
});

const glyphFrames: Readonly<Record<WhitespaceKind, stylex.StyleXStyles>> = {
  space: styles.space,
  tab: styles.boxed,
  newline: styles.boxed,
  return: styles.boxed,
  other: styles.boxed,
};

/**
 * A token's exact text in the mono face. Spaces show a faint dot and newlines, tabs and other invisible characters a
 * faint arrow or box, drawn beside the characters rather than in place of them. The text a reader copies is the
 * supplied text, and an empty token shows a faint ∅.
 */
export function TokenText({
  text,
  shouldWrap = true,
}: {
  readonly text: string;
  /** False keeps the token on one line, for a chip or a cell that clips what does not fit. */
  readonly shouldWrap?: boolean | undefined;
}): ReactNode {
  const segments = Array.from(text.matchAll(SEGMENTS), (match) => ({ start: match.index, text: match[0] }));

  if (segments.length === 0) {
    return <span {...stylex.props(styles.text, !shouldWrap && styles.line, styles.empty)} />;
  }

  return (
    <span {...stylex.props(styles.text, !shouldWrap && styles.line)}>
      {segments.map((segment) => {
        const kind = INVISIBLE.test(segment.text) ? (whitespaceKinds[segment.text] ?? 'other') : undefined;

        if (kind === undefined) {
          return segment.text;
        }

        return (
          <span key={segment.start} {...stylex.props(glyphFrames[kind], glyphs[kind])}>
            {segment.text}
          </span>
        );
      })}
    </span>
  );
}

export type TokenScaleLegendProps = TokenScale & {
  /** What the shade measures, with its unit. */
  readonly label: string;
  readonly locale: string;
  readonly format: ValueFormat;
  /** True when some token or cell has no value, so the legend explains the hollow mark. */
  readonly hasMissing?: boolean | undefined;
};

/** The key to a text chart's shades: the measure, a ramp across the domain, its bounds, and the hollow missing mark. */
export function TokenScaleLegend({
  label,
  domain,
  palette,
  locale,
  format,
  hasMissing = false,
}: TokenScaleLegendProps): ReactNode {
  const low = formatValue({ value: domain[0], locale, format });
  const high = formatValue({ value: domain[1], locale, format });
  const zero = formatValue({ value: 0, locale, format });
  const isDiverging = palette === 'diverging';

  return (
    <div {...stylex.props(styles.legend)}>
      <span>
        {isDiverging ? `${label}: below ${zero} in red, above in blue` : `${label}: a deeper shade is higher`}
      </span>
      <div
        role="img"
        aria-label={`${label} from ${low} to ${high}`}
        {...stylex.props(styles.ramp(tokenScaleGradient({ domain, palette })))}
      />
      <div aria-hidden {...stylex.props(styles.bounds)}>
        <span>{low}</span>
        {isDiverging && <span>{zero}</span>}
        <span>{high}</span>
      </div>
      {hasMissing && (
        <span {...stylex.props(styles.missing)}>
          <span {...stylex.props(styles.hollow)} />
          {MISSING_VALUE_TEXT}
        </span>
      )}
    </div>
  );
}

/**
 * A frame that scrolls sideways when its content is wider than the figure, and keeps the keyboard cursor in view. The
 * element under the cursor carries `data-token-cursor`.
 */
export function TokenScrollFrame({
  cursor,
  isBounded = false,
  children,
}: {
  /** The id under the keyboard cursor. The frame scrolls the marked element into view when it changes. */
  readonly cursor: string | null;
  /** True to scroll down as well, inside a frame no taller than most of the window, for sticky headers. */
  readonly isBounded?: boolean | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = ref.current;

    if (cursor !== null && frame !== null && frame.contains(document.activeElement)) {
      frame.querySelector('[data-token-cursor]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [cursor]);

  return (
    <div ref={ref} {...stylex.props(styles.frame, isBounded && styles.bounded)}>
      {children}
    </div>
  );
}

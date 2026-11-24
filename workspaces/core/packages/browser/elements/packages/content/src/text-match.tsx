import * as stylex from '@stylexjs/stylex';
import { matchRanges, matchSegments } from '@ui-sdk/react/text-match';
import type { MatchRange, MatchSegment } from '@ui-sdk/react/text-match';
import type { ReactNode } from 'react';
import { colors, radii, spacing } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  mark: { backgroundColor: colors.warningSoft, color: colors.ink, borderRadius: radii.sm, paddingInline: spacing.xxs },
  accent: { backgroundColor: colors.accentSoft, color: colors.accent },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
});

export type TextMatchTone = 'warning' | 'accent' | 'danger';
export type TextMatchMode = 'contains' | 'startsWith' | 'fuzzy';

export type TextMatchProps = {
  /** The full string to display. */
  readonly text: string;
  /** Highlight tone for matched ranges. Defaults to `'warning'`. */
  readonly tone?: TextMatchTone;
  /** Matching strategy when `query` is supplied. Defaults to `'contains'`. */
  readonly mode?: TextMatchMode;
} & (
  | { readonly query: string; readonly ranges?: never }
  | { readonly ranges: ReadonlyArray<MatchRange>; readonly query?: never }
);

/** Highlights matching spans of text using `@ui-sdk/react/text-match`, for search hits or token callouts. */
export function TextMatch({ text, query, ranges, tone = 'warning', mode = 'contains' }: TextMatchProps): ReactNode {
  const resolvedRanges: Array<MatchRange> =
    ranges === undefined ? (query.trim() === '' ? [] : matchRanges(text, query, mode)) : [...ranges];

  const segments: ReadonlyArray<MatchSegment> =
    resolvedRanges.length === 0 ? [{ text, match: false }] : matchSegments(text, resolvedRanges);

  const toneStyle = tone === 'accent' ? styles.accent : tone === 'danger' ? styles.danger : undefined;
  let offset = 0;

  return (
    <>
      {segments.map((segment) => {
        const key = `${offset}-${segment.match ? 'm' : 't'}`;
        offset += segment.text.length;

        return segment.match ? (
          <mark key={key} {...stylex.props(styles.mark, toneStyle)}>
            {segment.text}
          </mark>
        ) : (
          <span key={key}>{segment.text}</span>
        );
      })}
    </>
  );
}

export { fuzzyScore, matchRanges, matchSegments } from '@ui-sdk/react/text-match';
export type { MatchRange, MatchSegment } from '@ui-sdk/react/text-match';

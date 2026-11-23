import * as stylex from '@stylexjs/stylex';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

/** The narrowest the side panel of a two-part view may be before it moves under the main figure. */
const ASIDE_WIDTH = '300px';

/** The narrowest the main figure of a two-part view may be before the side panel moves under it. */
const MAIN_WIDTH = '420px';

/** The layout and words every interpretability view shares, so their panels line up when composed on one page. */
export const kitStyles = stylex.create({
  stack: { display: 'grid', gap: spacing.lg, minWidth: 0, alignContent: 'start' },
  tight: { display: 'grid', gap: spacing.sm, minWidth: 0, alignContent: 'start' },
  split: { display: 'flex', flexWrap: 'wrap', gap: spacing.xl, alignItems: 'flex-start', minWidth: 0 },
  main: { flexGrow: 3, flexShrink: 1, flexBasis: MAIN_WIDTH, minWidth: 0 },
  aside: {
    display: 'grid',
    gap: spacing.lg,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: ASIDE_WIDTH,
    minWidth: 0,
    alignContent: 'start',
  },
  card: {
    display: 'grid',
    gap: spacing.lg,
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignContent: 'start',
  },
  heading: { display: 'grid', gap: spacing.xxs, minWidth: 0 },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    fontWeight: typography.strongWeight,
    lineHeight: typography.sectionLineHeight,
    overflowWrap: 'anywhere',
  },
  meta: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  body: {
    margin: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    overflowWrap: 'anywhere',
  },
  muted: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  label: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    fontWeight: typography.mediumWeight,
    lineHeight: typography.captionLineHeight,
  },
  list: { display: 'flex', flexWrap: 'wrap', gap: spacing.xs, margin: 0, padding: 0, listStyle: 'none', minWidth: 0 },
  token: {
    paddingInline: spacing.xs,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    whiteSpace: 'pre',
  },
});

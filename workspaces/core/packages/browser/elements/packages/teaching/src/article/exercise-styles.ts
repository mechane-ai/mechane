import * as stylex from '@stylexjs/stylex';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

/** The look `Predict` and `Challenge` share: a quiet panel in the text column, with a kicker above the question. */
export const exerciseStyles = stylex.create({
  box: {
    display: 'grid',
    gap: spacing.md,
    marginBlock: spacing.xl,
    paddingBlock: spacing.lg,
    paddingInline: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    breakInside: 'avoid',
  },
  kicker: {
    margin: 0,
    color: colors.accent,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.strongWeight,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  prompt: { fontWeight: typography.mediumWeight },
  meta: { margin: 0, color: colors.muted, fontSize: typography.inputSize },
  controls: { display: 'grid', gap: spacing.md, maxWidth: '28rem' },
  result: { display: 'grid', gap: spacing.sm },
  verdict: { margin: 0 },
  right: { color: colors.accent, fontWeight: typography.strongWeight },
  wrong: { color: colors.warning, fontWeight: typography.strongWeight },
  details: { display: 'grid', gap: spacing.sm },
  summary: { color: colors.accent, cursor: 'pointer', fontSize: typography.inputSize },
  hints: { display: 'grid', gap: spacing.xs, margin: 0, paddingInlineStart: spacing.xl, color: colors.muted },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
});

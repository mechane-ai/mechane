import * as stylex from '@stylexjs/stylex';
import { colors, conditions, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

export const fieldStyles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0, fontFamily: typography.fontFamily },
  label: { color: colors.ink, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  description: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  error: { color: colors.danger, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  input: {
    'display': 'block',
    'boxSizing': 'border-box',
    'width': '100%',
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.sm,
    'paddingBlock': controls.paddingBlock,
    'paddingInline': controls.paddingInline,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': { default: typography.inputSize, [conditions.coarsePointer]: typography.touchInputSize },
    'lineHeight': typography.bodyLineHeight,
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 1,
    },
    ':is([data-invalid], [aria-invalid="true"])': { borderColor: colors.danger },
    ':disabled': { color: colors.muted, backgroundColor: colors.canvas, cursor: 'not-allowed' },
    '::placeholder': { color: colors.muted },
  },
  textarea: { minHeight: 144, resize: 'vertical', lineHeight: typography.multilineLineHeight },
});

export const inputSizeStyles = stylex.create({
  sm: {
    minHeight: { default: controls.smHeight, [conditions.coarsePointer]: controls.coarseTarget },
    paddingBlock: spacing.xs,
    fontSize: { default: typography.bodySize, [conditions.coarsePointer]: typography.touchInputSize },
  },
  md: {},
});

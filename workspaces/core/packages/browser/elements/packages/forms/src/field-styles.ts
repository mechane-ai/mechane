import * as stylex from '@stylexjs/stylex';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { colors, controls, typography } from '../../foundations/src/tokens.stylex.ts';

export const fieldStyles = stylex.create({
  error: {
    color: colors.danger,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  input: {
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
  compactTextarea: { minHeight: 80, maxHeight: '30dvh' },
  growingTextarea: { minHeight: 0, maxHeight: '16lh', fieldSizing: 'content', resize: 'none' },
});

export type TextareaAppearance = 'field' | 'plain';

const textareaStyles = stylex.create({ field: {} });

export const textareaAppearanceStyles: Readonly<Record<TextareaAppearance, stylex.StyleXStyles>> = {
  field: textareaStyles.field,
  plain: controlStyles.plainTextarea,
};

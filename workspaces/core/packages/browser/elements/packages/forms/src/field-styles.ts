import * as stylex from '@stylexjs/stylex';
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
});

export type TextareaAppearance = 'field' | 'plain';

const textareaStyles = stylex.create({
  field: {},
  plain: {
    'minHeight': typography.bodyLineHeight,
    'maxHeight': '30dvh',
    'fieldSizing': 'content',
    'resize': 'none',
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': 0,
    'backgroundColor': 'transparent',
    ':focus-visible': { outlineStyle: 'none' },
    ':disabled': { backgroundColor: 'transparent' },
  },
});

export const textareaAppearanceStyles: Readonly<Record<TextareaAppearance, stylex.StyleXStyles>> = {
  field: textareaStyles.field,
  plain: textareaStyles.plain,
};

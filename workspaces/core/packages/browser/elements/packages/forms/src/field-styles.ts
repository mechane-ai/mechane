import * as stylex from '@stylexjs/stylex';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { colors, typography } from '../../foundations/src/tokens.stylex.ts';

export const fieldStyles = stylex.create({
  error: {
    color: colors.danger,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
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

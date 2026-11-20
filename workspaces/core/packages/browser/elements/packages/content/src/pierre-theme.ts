import type { Theme } from '@pierre/highlights';
import { colors, controls, spacing, syntaxColors, typography } from '../../foundations/src/tokens.stylex.ts';

export const highlightTheme = {
  name: 'Elements',
  appearance: 'light',
  cssVariables: {
    prefix: '--elements-syntax-',
    defaults: {
      foreground: colors.ink,
      background: colors.surface,
      keyword: syntaxColors.keyword,
      string: syntaxColors.string,
      comment: syntaxColors.comment,
      number: syntaxColors.number,
      type: syntaxColors.type,
      punctuation: colors.muted,
    },
  },
  style: {
    'editor.background': 'background',
    'editor.foreground': 'foreground',
    'syntax': {
      keyword: { color: 'keyword', font_weight: 600 },
      string: 'string',
      comment: 'comment',
      number: 'number',
      type: 'type',
      function: 'foreground',
      operator: 'punctuation',
      punctuation: 'punctuation',
    },
  },
} as const satisfies Theme;

export const pierreCSS = `
:host {
  color-scheme: inherit;
  --diffs-font-family: ${typography.monoFamily};
  --diffs-header-font-family: ${typography.fontFamily};
  --diffs-font-size: ${typography.captionSize};
  --diffs-line-height: ${typography.bodyLineHeight};
  --diffs-gap-inline: ${spacing.sm};
  --diffs-gap-block: ${spacing.sm};
  --diffs-bg: ${colors.surface};
  --diffs-fg: ${colors.ink};
  --diffs-fg-number: ${colors.muted};
  --diffs-bg-addition: ${colors.accentSoft};
  --diffs-bg-deletion: ${colors.dangerSoft};
  --diffs-addition-color-override: ${colors.accent};
  --diffs-deletion-color-override: ${colors.danger};
  --diffs-modified-color-override: ${colors.focus};
  --diffs-bg-context-override: ${colors.surface};
  --diffs-bg-context-gutter-override: ${colors.canvas};
  --diffs-bg-separator-override: ${colors.canvas};
  --diffs-selection-background: ${colors.accentSoft};
  font-family: ${typography.monoFamily};
  font-size: ${typography.captionSize};
  color: ${colors.ink};
  background: ${colors.surface};
}
pre { font-family: ${typography.monoFamily}; font-size: ${typography.captionSize}; line-height: ${typography.bodyLineHeight}; }
[data-line-number] { color: ${colors.muted}; }
[data-diffs-header] {
  min-height: ${controls.height};
  padding-block: ${spacing.sm};
  padding-inline: ${spacing.md};
  border-bottom: 1px solid ${colors.line};
  font-size: ${typography.captionSize};
  line-height: ${typography.captionLineHeight};
  font-weight: ${typography.mediumWeight};
  flex-wrap: wrap;
}
[data-header-content] { flex: 1 1 12ch; }
`;

import * as stylex from '@stylexjs/stylex';
import {
  avatarColors,
  chartColors,
  colors,
  darkAvatarColors,
  darkChartColors,
  darkColors,
  darkShadows,
  darkSyntaxColors,
  shadows,
  syntaxColors,
} from './tokens.stylex.ts';

const styles = stylex.create({
  root: { color: colors.ink },
  light: { colorScheme: 'light' },
  dark: { colorScheme: 'dark' },
});

const darkColorTheme = stylex.createTheme(colors, {
  canvas: darkColors.canvas,
  surface: darkColors.surface,
  ink: darkColors.ink,
  inkHover: darkColors.inkHover,
  inverse: darkColors.inverse,
  muted: darkColors.muted,
  faint: darkColors.faint,
  line: darkColors.line,
  focus: darkColors.focus,
  accent: darkColors.accent,
  accentSoft: darkColors.accentSoft,
  warning: darkColors.warning,
  warningSoft: darkColors.warningSoft,
  danger: darkColors.danger,
  dangerHover: darkColors.dangerHover,
  dangerSoft: darkColors.dangerSoft,
  overlay: darkColors.overlay,
});

const darkChartTheme = stylex.createTheme(chartColors, {
  series1: darkChartColors.series1,
  series2: darkChartColors.series2,
  series3: darkChartColors.series3,
  series4: darkChartColors.series4,
  series5: darkChartColors.series5,
  series6: darkChartColors.series6,
  negative: darkChartColors.negative,
  positive: darkChartColors.positive,
  missing: darkChartColors.missing,
});

const darkAvatarTheme = stylex.createTheme(avatarColors, {
  identity1: darkAvatarColors.identity1,
  identity2: darkAvatarColors.identity2,
  identity3: darkAvatarColors.identity3,
  identity4: darkAvatarColors.identity4,
  identity5: darkAvatarColors.identity5,
  identity6: darkAvatarColors.identity6,
  identity7: darkAvatarColors.identity7,
  identity8: darkAvatarColors.identity8,
  identity9: darkAvatarColors.identity9,
  identity10: darkAvatarColors.identity10,
  identity11: darkAvatarColors.identity11,
  identity12: darkAvatarColors.identity12,
  identity13: darkAvatarColors.identity13,
  identity14: darkAvatarColors.identity14,
  identity15: darkAvatarColors.identity15,
  identity16: darkAvatarColors.identity16,
  identity17: darkAvatarColors.identity17,
  identity18: darkAvatarColors.identity18,
  identity19: darkAvatarColors.identity19,
  identity20: darkAvatarColors.identity20,
  identity21: darkAvatarColors.identity21,
  identity22: darkAvatarColors.identity22,
  identity23: darkAvatarColors.identity23,
  identity24: darkAvatarColors.identity24,
});

const darkSyntaxTheme = stylex.createTheme(syntaxColors, {
  keyword: darkSyntaxColors.keyword,
  string: darkSyntaxColors.string,
  comment: darkSyntaxColors.comment,
  number: darkSyntaxColors.number,
  type: darkSyntaxColors.type,
});

const darkShadowTheme = stylex.createTheme(shadows, { popup: darkShadows.popup });

// Apply to the document root so portaled controls inherit the same color scheme.
export const themeProps = {
  light: stylex.props(styles.root, styles.light),
  dark: stylex.props(
    styles.root,
    styles.dark,
    darkColorTheme,
    darkChartTheme,
    darkAvatarTheme,
    darkSyntaxTheme,
    darkShadowTheme,
  ),
} as const;

import * as stylex from '@stylexjs/stylex';
import {
  chartColors,
  colors,
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
  dark: stylex.props(styles.root, styles.dark, darkColorTheme, darkChartTheme, darkSyntaxTheme, darkShadowTheme),
} as const;

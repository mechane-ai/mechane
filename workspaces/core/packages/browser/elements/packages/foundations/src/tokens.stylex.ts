import * as stylex from '@stylexjs/stylex';

export const colors = stylex.defineVars({
  canvas: '#f5f5f5',
  surface: '#ffffff',
  ink: '#0a0a0a',
  inkHover: '#333333',
  inverse: '#ffffff',
  muted: '#545454',
  faint: '#9d9d9d',
  line: '#ebebeb',
  focus: '#0a69e2',
  accent: '#21684f',
  accentSoft: '#eef6f1',
  warning: '#875900',
  warningSoft: '#fff7e6',
  danger: '#b13838',
  dangerHover: '#922d2d',
  dangerSoft: '#fff1f1',
  overlay: '#00000066',
});

export const darkColors = stylex.defineConsts({
  canvas: '#191919',
  surface: '#101010',
  ink: '#f2f2f2',
  inkHover: '#d6d6d6',
  inverse: '#0a0a0a',
  muted: '#b0b0b0',
  faint: '#777777',
  line: '#303030',
  focus: '#79b3ff',
  accent: '#8ed3b3',
  accentSoft: '#152b22',
  warning: '#edc479',
  warningSoft: '#302511',
  danger: '#f59696',
  dangerHover: '#ffc3c3',
  dangerSoft: '#321c1c',
  overlay: '#00000099',
});

export const chartColors = stylex.defineVars({
  series1: '#5178a8',
  series2: '#568b76',
  series3: '#9077ac',
  series4: '#b18843',
  series5: '#4f9296',
  series6: '#ac7186',
  negative: '#b95d66',
  positive: '#46799f',
  missing: '#e7e7e7',
});

export const darkChartColors = stylex.defineConsts({
  series1: '#86a9d3',
  series2: '#83b69f',
  series3: '#b49bce',
  series4: '#cfad70',
  series5: '#80bbc0',
  series6: '#d39aad',
  negative: '#e0929b',
  positive: '#80add0',
  missing: '#363636',
});

export const syntaxColors = stylex.defineVars({
  keyword: '#785ba1',
  string: '#21684f',
  comment: '#626262',
  number: '#754c00',
  type: '#1c628f',
});

export const darkSyntaxColors = stylex.defineConsts({
  keyword: '#c4a1e5',
  string: '#8ed3b3',
  comment: '#a3a3a3',
  number: '#edc479',
  type: '#84bce3',
});

export const spacing = stylex.defineVars({
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
});

export const typography = stylex.defineVars({
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
  monoFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  bodySize: '13px',
  bodyLineHeight: '20px',
  multilineLineHeight: '1.6',
  captionSize: '12px',
  captionLineHeight: '18px',
  inputSize: '14px',
  touchInputSize: '16px',
  sectionSize: '16px',
  sectionLineHeight: '22px',
  headingSize: '36px',
  headingLineHeight: '44px',
  compactHeadingSize: '28px',
  compactHeadingLineHeight: '36px',
  headingTracking: '-0.035em',
});

export const controls = stylex.defineVars({
  smHeight: '32px',
  mdHeight: '36px',
  coarseTarget: '44px',
  iconSize: '16px',
  paddingInline: '10px',
  paddingBlock: '7px',
  gap: '6px',
  focusWidth: '2px',
  disabledOpacity: '0.45',
});

export const radii = stylex.defineVars({ sm: '4px', md: '6px' });

export const motion = stylex.defineVars({
  duration: '140ms',
  easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
  drawerDuration: '220ms',
  drawerEasing: 'cubic-bezier(0.32, 0.72, 0, 1)',
});

export const shadows = stylex.defineVars({ popup: '0 4px 16px #00000014' });

export const darkShadows = stylex.defineConsts({ popup: '0 4px 16px #00000066' });

export const layers = stylex.defineConsts({ backdrop: '20', dialog: '21', popup: '30', tooltip: '40', skipLink: '50' });

export const conditions = stylex.defineConsts({
  coarsePointer: '@media (pointer: coarse)',
  hoverPointer: '@media (hover: hover) and (pointer: fine)',
  compactText: '@media (max-width:639px)',
  compactTable: '@media (max-width:600px)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
});

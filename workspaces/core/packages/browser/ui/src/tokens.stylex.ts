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

export const layers = stylex.defineConsts({ backdrop: '20', dialog: '21', popup: '30', tooltip: '40', skipLink: '50' });

export const conditions = stylex.defineConsts({
  coarsePointer: '@media (pointer: coarse)',
  hoverPointer: '@media (hover: hover) and (pointer: fine)',
  compactText: '@media (max-width:639px)',
  compactTable: '@media (max-width:600px)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
});

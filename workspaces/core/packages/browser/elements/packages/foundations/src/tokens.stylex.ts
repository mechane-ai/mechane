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

export const avatarColors = stylex.defineVars({
  identity1: '#e3291c',
  identity2: '#e1571c',
  identity3: '#e31c54',
  identity4: '#e31c8d',
  identity5: '#e31cd2',
  identity6: '#b51ce3',
  identity7: '#801ce3',
  identity8: '#4a1ce3',
  identity9: '#1c1ce3',
  identity10: '#1c51e3',
  identity11: '#1c80e3',
  identity12: '#178db8',
  identity13: '#13919a',
  identity14: '#129487',
  identity15: '#139671',
  identity16: '#139858',
  identity17: '#13983d',
  identity18: '#13981e',
  identity19: '#2b9813',
  identity20: '#519412',
  identity21: '#748d11',
  identity22: '#948412',
  identity23: '#b17816',
  identity24: '#d1661a',
});

export const syntaxColors = stylex.defineVars({
  keyword: '#785ba1',
  string: '#21684f',
  comment: '#626262',
  number: '#754c00',
  type: '#1c628f',
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
  regularWeight: '400',
  mediumWeight: '500',
  strongWeight: '600',
  boldWeight: '700',
  bodySize: '13px',
  bodyLineHeight: '20px',
  multilineLineHeight: '1.6',
  proseLineHeight: '1.7',
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
  height: '32px',
  coarseTarget: '44px',
  iconSize: '16px',
  paddingInline: '10px',
  paddingBlock: '5px',
  gap: '6px',
  focusWidth: '2px',
  disabledOpacity: '0.45',
});

export const pageGeometry = stylex.defineVars({ inset: '16px', toolbarHeight: '48px', sectionGap: '32px' });

export const radii = stylex.defineVars({ sm: '4px', md: '6px' });

export const motion = stylex.defineVars({
  duration: '140ms',
  easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
  drawerDuration: '220ms',
  drawerEasing: 'cubic-bezier(0.32, 0.72, 0, 1)',
});

export const shadows = stylex.defineVars({ popup: '0 4px 16px #00000014', selection: 'inset 2px 0 currentColor' });

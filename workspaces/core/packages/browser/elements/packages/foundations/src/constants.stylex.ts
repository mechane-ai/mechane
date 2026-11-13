import * as stylex from '@stylexjs/stylex';

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

export const darkAvatarColors = stylex.defineConsts({
  identity1: '#f07d75',
  identity2: '#f09a75',
  identity3: '#f07598',
  identity4: '#f075bb',
  identity5: '#f075e6',
  identity6: '#d375f0',
  identity7: '#b375f0',
  identity8: '#9275f0',
  identity9: '#7575f0',
  identity10: '#7596f0',
  identity11: '#75b3f0',
  identity12: '#75cff0',
  identity13: '#75e8f0',
  identity14: '#75f0e3',
  identity15: '#75f0cd',
  identity16: '#75f0b5',
  identity17: '#75f09c',
  identity18: '#75f080',
  identity19: '#8cf075',
  identity20: '#b0f075',
  identity21: '#d7f075',
  identity22: '#f0e175',
  identity23: '#f0c375',
  identity24: '#f0a875',
});

export const darkSyntaxColors = stylex.defineConsts({
  keyword: '#c4a1e5',
  string: '#8ed3b3',
  comment: '#a3a3a3',
  number: '#edc479',
  type: '#84bce3',
});

export const loading = stylex.defineConsts({ delaySeconds: 2, revealMs: 80, placeholderMs: 120 });

export const darkShadows = stylex.defineConsts({ popup: '0 4px 16px #00000066' });

export const layers = stylex.defineConsts({
  sticky: '1',
  backdrop: '20',
  dialog: '21',
  popup: '30',
  tooltip: '40',
  skipLink: '50',
});

export const tableGeometry = stylex.defineConsts({ rowHeight: 48, headerHeight: 36 });

export const conditions = stylex.defineConsts({
  coarsePointer: '@media (pointer: coarse)',
  hoverPointer: '@media (hover: hover) and (pointer: fine)',
  compactText: '@media (max-width:639px)',
  compactTable: '@media (max-width:600px)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
});

import * as stylex from '@stylexjs/stylex';

/** Neutral surfaces, semantic status colors, and keyboard focus shared by the console. */
export const colors = stylex.defineVars({
  canvas: '#f5f5f5',
  surface: '#ffffff',
  ink: '#0a0a0a',
  muted: '#737373',
  faint: '#a3a3a3',
  line: '#ebebeb',
  focus: '#0a69e2',
  accent: '#21684f',
  accentSoft: '#eef6f1',
  warning: '#875900',
  warningSoft: '#fff7e6',
  danger: '#b13838',
  dangerSoft: '#fff1f1',
});

/** Shared shell dimensions keep navigation and screen toolbars aligned. */
export const frame = stylex.defineVars({
  sidebarWidth: '240px',
  toolbarHeight: '48px',
  navigationHeight: '36px',
  iconSize: '16px',
  brandHeight: '40px',
  navigationInset: '8px',
});

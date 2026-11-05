import * as stylex from '@stylexjs/stylex';

export const frame = stylex.defineVars({
  sidebarWidth: '240px',
  toolbarHeight: '48px',
  navigationHeight: '34px',
  navigationInset: '8px',
  navigationPadding: '7px',
  footerHeight: '40px',
  footerPadding: '14px',
  detailWidth: '84%',
  detailMaxWidth: '980px',
  detailTop: '44px',
  detailBottom: '64px',
  detailMobileTop: '32px',
  detailMobileBottom: '52px',
  recordContentWidth: '480px',
  recordAsideWidth: '240px',
});

export const frameConditions = stylex.defineConsts({
  sidebarMobile: '@media (max-width:800px)',
  sidebarDesktopQuery: '(min-width:801px)',
  sidebarCoarse: '@media (min-width:801px) and (pointer: coarse)',
  detailMobile: '@media (max-width:720px)',
  toolbarCompact: '@container toolbar (max-width:600px)',
  workbenchCompact: '@container workbench (max-width:860px)',
});

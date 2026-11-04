import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Import boundaries and isolated stories establish the generic libraries' ownership. */
export const uiPresentationBoundaries = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'ui-controls-public-entry',
      comment: 'Import shared controls through their public entry, such as `../index.ts` from the layout module',
      from: { path: '^packages/browser/ui/src/(layout|charts)/' },
      to: { path: '^packages/browser/ui/src/[^/]+$', pathNot: '/(index[.]ts|tokens[.]stylex[.]ts)$' },
      standard: '065',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'ui-controls-independent',
      comment:
        'Keep controls independent of layouts and charts, such as `Button` composed inside `AppShell` by the application',
      from: { path: '^packages/browser/ui/src/[^/]+$', pathNot: '[.]stories[.]tsx$' },
      to: { path: '^packages/browser/ui/src/(layout|charts)/' },
      standard: '065',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'ui-layout-independent',
      comment: 'Compose charts in the application, such as `Waterfall` passed as `AppShell` content',
      from: { path: '^packages/browser/ui/src/layout/' },
      to: { path: '^packages/browser/ui/src/charts/' },
      standard: '065',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'ui-charts-independent',
      comment:
        'Render charts in the space their caller supplies, such as `width` accepted without importing `AppShell`',
      from: { path: '^packages/browser/ui/src/charts/' },
      to: { path: '^packages/browser/ui/src/layout/' },
      standard: '065',
    },
  ],
} as const satisfies ContractEnforcement;

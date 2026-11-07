import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The product registry maps the shared catalog to Elements without coupling Elements to Mechane records. */
export const structuredPresentation = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'structured-renderer-owner',
      comment: 'Render catalog specifications through the product registry, such as `console-views/src/structured`',
      from: {
        path: '^packages/',
        pathNot: '^packages/browser/console-views/src/(?:structured/|structured-message[.]tsx$)',
      },
      to: { path: 'node_modules/@json-render/react/' },
      standard: '126',
    },
  ],
} as const satisfies ContractEnforcement;

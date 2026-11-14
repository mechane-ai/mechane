import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

export const uiNotificationFeedback = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'ui-toast-vendor-owner',
      comment:
        'Import Elements notifications, such as `import { toast } from "@mechane-ai/elements/feedback"`; Sonner belongs only to the adapter and renderer (133)',
      from: {
        path: '^packages/browser/',
        pathNot: '^packages/browser/elements/packages/feedback/src/(?:notifications[.]ts|toast[.]tsx)$',
      },
      to: { path: 'node_modules/sonner' },
      standard: '133',
    },
  ],
} as const satisfies ContractEnforcement;

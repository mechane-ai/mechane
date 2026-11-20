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
        'Import Elements notifications, such as `import { toast } from "@mechane-ai/elements/feedback"`; UI SDK toast primitives belong to the notification family (133)',
      from: { path: '^packages/browser/', pathNot: '^packages/browser/elements/packages/feedback/src/' },
      to: { path: 'node_modules/@ui-sdk/(?:react|core)/(?:dist/)?toast(?:/|[.]|$)' },
      standard: '133',
    },
  ],
} as const satisfies ContractEnforcement;

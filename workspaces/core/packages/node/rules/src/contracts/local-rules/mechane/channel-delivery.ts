import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Integrations authenticate platform events before submitting generic notifications to Mechane. */
export const channelDelivery = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'notification-integration-boundary',
      comment: 'Move platform adapters into the external notification producer, such as `createSlackAdapter` in Nexus',
      from: { path: '^packages/' },
      to: { path: 'node_modules/(?:chat|@chat-adapter/[^/]+)/' },
      standard: '125',
    },
  ],
} as const satisfies ContractEnforcement;

import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** One Slack transport owner translates platform messages and verifies signed ingress. */
export const channelDelivery = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'slack-platform-owner',
      comment: 'Use the channel owner for Slack operations, such as `runtime/src/channels`',
      from: { path: '^packages/', pathNot: '^packages/node/(?:runtime|server)/src/channels/' },
      to: { path: 'node_modules/@chat-adapter/slack/' },
      standard: '125',
    },
  ],
} as const satisfies ContractEnforcement;

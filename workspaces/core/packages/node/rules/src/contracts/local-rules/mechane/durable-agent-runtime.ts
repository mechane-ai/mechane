import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

export const durableAgentRuntime = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'single-durable-agent-owner',
      comment: 'Use Pi for agent execution, such as `Harness` in the Worker runtime',
      from: { path: '^packages/' },
      to: { path: 'node_modules/(?:workflow|@workflow/[^/]+|@ai-sdk/workflow)/' },
      standard: '124',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'durable-harness-owner',
      comment: 'Construct Pi in its Worker owner, such as `Harness` in packages/worker/runtime',
      from: { path: '^packages/', pathNot: '^packages/(?:worker/runtime|node/smoke|node/testing)/' },
      to: { path: 'node_modules/@earendil-works/pi-durable/' },
      standard: '124',
    },
  ],
} as const satisfies ContractEnforcement;

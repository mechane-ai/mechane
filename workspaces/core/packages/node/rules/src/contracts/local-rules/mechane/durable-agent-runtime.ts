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
      name: 'shared-bash-native-surface',
      comment:
        'Import native Bash tools and environment APIs in the shared binding, such as `createBashTool`; applications own Harness',
      from: { path: '^packages/shared/bash/' },
      to: {
        path: 'node_modules/@earendil-works/pi-durable/',
        pathNot: 'node_modules/@earendil-works/pi-durable/dist/(?:env|tools)/',
      },
      standard: '124',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'durable-harness-owner',
      comment: 'Construct Pi in its Worker owner, such as `Harness` in packages/worker/runtime',
      from: { path: '^packages/', pathNot: '^packages/(?:worker/runtime|shared/bash|node/smoke|node/testing)/' },
      to: { path: 'node_modules/@earendil-works/pi-durable/' },
      standard: '124',
    },
  ],
} as const satisfies ContractEnforcement;

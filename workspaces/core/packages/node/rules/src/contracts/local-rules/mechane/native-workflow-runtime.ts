import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Browsers consume UI streams; durable scheduling stays in the Node service. */
export const nativeWorkflowRuntime = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'workflow-server-owner',
      comment: 'Keep Workflow execution dependencies in the Node runtime, such as `workflow` in a durable step',
      from: { path: '^packages/browser/' },
      to: { path: 'node_modules/(?:workflow|@workflow/[^/]+)/' },
      standard: '124',
    },
  ],
} as const satisfies ContractEnforcement;

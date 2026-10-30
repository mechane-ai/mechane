import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `api-typescript-request-paths`: every path, URL, query and key from its named builder (SC-10). */
export const apiTypescriptRequestPaths = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      name: 'inline-path-string',
      standard: 'SC-10',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
      violation: [`const path = \`/machines/\${machineId}/health\`;`, "const url = '/packs/' + sha;"],
      allowed: [
        `function guestHealthPath({ machineId }: GuestHealthPathInput): string { return \`/\${GuestSegment.Machines}/\${machineId}/\${GuestSegment.Health}\`; }`,
        `const line = \`listing \${count} events\`;`,
      ],
    },
  ],
} as const satisfies ContractEnforcement;

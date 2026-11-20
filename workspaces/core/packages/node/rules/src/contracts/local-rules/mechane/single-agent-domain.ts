import { ADOPTED, AST_GREP_DEFAULTS, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Enforces Managed Agents as the sole agent execution model without retired mech, turn, or archive coupling. */
export const singleAgentDomain = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'managed-no-mech-runtime-imports',
      comment:
        'Keep managed runtime and server handlers free of retired mech and archive modules, such as `@mechane/session-runtime`',
      from: { path: '^packages/worker/(?:runtime|server)/src/managed/' },
      to: {
        path: '^packages/worker/(?:runtime/src/(?:actor/archive|operations/(?:mechs|turns|routines))|server/src/http/(?:import-mech|mech-maintenance))',
      },
      standard: '136',
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'managed-no-mech-table-sql',
      standard: '136',
      violation: ["const sql = 'REFERENCES mechane.mechs(id)';"],
      allowed: ["const sql = 'REFERENCES mechane.managed_agents(id)';"],
    },
  ],
} as const satisfies ContractEnforcement;

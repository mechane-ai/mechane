import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Comment-only legal assets whose imports retain required notices in the Worker bundle. */
const VALUES = {
  noticeImports: [
    '../../../../licenses/apache-2.0.js',
    '../../../../licenses/cfworker-json-schema.js',
    '../../../../licenses/content-type.js',
    '../../../../licenses/cookie.js',
    '../../../../licenses/effect.js',
    '../../../../licenses/eventsource-parser.js',
    '../../../../licenses/jose.js',
    '../../../../licenses/model-context-protocol.js',
    '../../../../licenses/openai.js',
    '../../../../licenses/partial-json.js',
    '../../../../licenses/pi.js',
    '../../../../licenses/pkce-challenge.js',
    '../../../../licenses/typebox.js',
    '../../../../licenses/zod.js',
  ],
} as const;

/** What enforces `code-typescript-entry-points`: ES modules with named exports only, and no namespace import. */
export const codeTypescriptEntryPoints = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      name: 'import/no-unassigned-import',
      value: [Severity.Error, { allow: VALUES.noticeImports }],
      violation: ["import './initialize.ts';", "import '../../../../licenses/unreviewed.js';"],
      allowed: ["import '../../../../licenses/effect.js';"],
      standard: '005',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'import/no-namespace',
      value: Severity.Error,
      standard: 'ST-10',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'import/no-default-export',
      value: Severity.Error,
      exemptRoles: [FileRole.WorkerModule],
      standard: '005',
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'import/no-commonjs',
      value: Severity.Error,
      exemptRoles: [FileRole.CruiserConfiguration],
      standard: '005',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'import/unambiguous',
      value: Severity.Error,
      exemptRoles: [FileRole.CruiserConfiguration],
      standard: '005',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'entry-point-re-exports',
      exemptRoles: [FileRole.EntryPoint, FileRole.WorkerModule],
      standard: 'ST-10',
      violation: ["export { parseLine } from './parse-line.ts';", 'export { parseLine };'],
      allowed: ['export function parseLine({ line }: LineInput) { return line; }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'entry-point-statements',
      standard: 'ST-10',
      violation: ['export const LIMIT = 3;', "export * from './parse-line.ts';"],
      allowed: ["export { parseLine } from './parse-line.ts';", "export type { Line } from './types.ts';"],
    },
  ],
} as const satisfies ContractEnforcement;

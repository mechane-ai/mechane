import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RESTRICTED_DEFAULTS,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-environment-settings`: only a settings module reads the environment and the command line. */
export const codeEnvironmentSettings = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'node/no-process-env',
      value: Severity.Error,
      exemptRoles: [FileRole.Settings],
      standard: 'ST-31',
    },
    {
      ...RESTRICTED_DEFAULTS,
      message:
        "Read the command line and the runtime's path once, in the program's settings module, such as `loadStackSettings()`",
      properties: { process: ['argv', 'execPath'] },
      imports: [],
      exemptRoles: [FileRole.Settings],
      standard: 'ST-31',
      ...ADOPTED,
    },
    {
      ...RESTRICTED_DEFAULTS,
      message: 'Use the global `process` in a settings or output module, such as `loadStackSettings()`',
      properties: {},
      imports: [
        { module: 'node:process', names: [] },
        { module: 'process', names: [] },
      ],
      exemptRoles: [],
      standard: 'ST-31',
      ...ADOPTED,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'raw-binding-read',
      standard: 'ST-31',
      violation: ['const origin = env.ORIGIN;', 'const variables = this.env;'],
      allowed: ['const origin = settings.origin;'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'raw-environment-type',
      exemptRoles: [FileRole.Settings],
      standard: 'ST-31',
      violation: ['type Input = { readonly variables: NodeJS.ProcessEnv };'],
      allowed: ['type Input = { readonly settings: StackSettings };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'raw-worker-environment',
      exemptRoles: [FileRole.WorkerModule],
      standard: 'ST-31',
      violation: ['type Input = { readonly environment: WorkerEnvironment };'],
      allowed: ['type Input = { readonly settings: WorkerSettings };'],
    },
  ],
} as const satisfies ContractEnforcement;

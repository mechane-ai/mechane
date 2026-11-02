import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `cli-output-channels`: only an output module writes, logs or sets the exit status, never a number. */
export const cliOutputChannels = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'no-console',
      value: Severity.Error,
      exemptRoles: [FileRole.Output],
      standard: 'CP-05',
    },
    { ...OXLINT_DEFAULTS, ...ADOPTED, name: 'unicorn/no-process-exit', value: Severity.Error, standard: 'CP-05' },
    {
      ...RESTRICTED_DEFAULTS,
      message:
        "Write output and set the exit status through the program's output module, such as `writeResult({ line })`",
      properties: { process: ['stdout', 'stderr', 'exitCode'] },
      imports: [],
      exemptRoles: [FileRole.Output],
      standard: 'CP-05',
      ...ADOPTED,
    },
    {
      ...RESTRICTED_DEFAULTS,
      message: "End the process by setting its exit status in the output module's finish, such as `finish({ status })`",
      properties: { process: ['exit'] },
      imports: [],
      exemptRoles: [],
      standard: 'CP-05',
      ...ADOPTED,
    },
    {
      ...RESTRICTED_DEFAULTS,
      message:
        "Write diagnostics through the program's output module or `writeLog`, such as `writeDiagnostic({ line })`",
      properties: {
        Effect: [
          'log',
          'logDebug',
          'logError',
          'logFatal',
          'logInfo',
          'logTrace',
          'logWarning',
          'logWithLevel',
          'withSpan',
          'withSpanScoped',
          'annotateLogs',
          'annotateLogsScoped',
        ],
      },
      imports: [{ module: 'effect', names: ['Console'] }],
      exemptRoles: [],
      standard: 'EF-19',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Proof,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'numeric-exit-status',
      standard: 'CP-05',
      violation: ['finish({ status: 1 });', 'function exit(): CheckStatus { return 0; }'],
      allowed: ['finish({ status: CheckStatus.Failed });'],
    },
  ],
} as const satisfies ContractEnforcement;

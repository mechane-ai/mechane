import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FileRole,
  FixBehavior,
  OWNED_DEFAULTS,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { PLACEMENT_RULES } from './placement-rules.ts';
import { ROLE_ORDER_RULES } from './role-order-rules.ts';

/** The code lines a file may hold, blank and comment lines aside. */
const VALUES = { fileLines: 120 } as const;

/**
 * What enforces `code-module-file-roles`: each file's length, its name and one value, and pure role files in their
 * order. The placement normalizer puts each declaration beside its users, and a ratchet holds each it cannot move.
 */
export const codeModuleFileRoles = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      name: 'max-lines',
      value: [Severity.Error, { max: VALUES.fileLines, skipBlankLines: true, skipComments: true }],
      exemptRoles: [FileRole.EntryPoint, FileRole.Catalog, FileRole.ObjectClass, FileRole.CruiserConfiguration],
      standard: 'ST-21',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OWNED_DEFAULTS,
      name: 'file-names',
      behavior: FixBehavior.BindingNames,
      standard: 'NM-20',
      violation: [
        { 'scripts/start-stack.ts': 'export function stopStack(): void {}\n' },
        { 'packages/node/testing/src/cli/run-cli.ts': 'export function refusedCli(): void {}\n' },
      ],
      allowed: [{ 'scripts/start-stack.ts': 'export function startStack(): void {}\n' }],
      ...ADOPTED,
    },
    ...PLACEMENT_RULES,
    {
      ...OWNED_DEFAULTS,
      name: 'one-value',
      standard: 'ST-18',
      violation: [
        { 'scripts/start-stack.ts': 'export function startStack(): void {}\nexport function stopStack(): void {}\n' },
        {
          'packages/node/testing/src/cli/run-cli.ts':
            'export function runCli(): void {}\nexport function refusedCli(): void {}\n',
        },
      ],
      allowed: [{ 'scripts/start-stack.ts': 'export function startStack(): void {}\n' }],
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.Packages,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'declaration-file-role',
      standard: 'ST-20',
      violation: [
        'export function parseLine({ line }: LineInput) { return line; }',
        'export const parseLine = ({ line }: LineInput) => line;',
      ],
      allowed: ['export const LIMIT = 3;'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'types-file-role',
      behavior: FixBehavior.TypeOnly,
      standard: 'ST-20',
      violation: ['export const LIMIT = 3;', 'export function parse() { return 1; }'],
      allowed: ['export type Line = { readonly text: string };'],
    },
    ...ROLE_ORDER_RULES,
  ],
} as const satisfies ContractEnforcement;

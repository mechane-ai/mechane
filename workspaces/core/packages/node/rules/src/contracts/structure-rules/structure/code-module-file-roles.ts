import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Special-purpose declaration files remain recognizable without forcing every concept into separate role files. */
export const codeModuleFileRoles = {
  values: {},
  rules: [
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
  ],
} as const satisfies ContractEnforcement;

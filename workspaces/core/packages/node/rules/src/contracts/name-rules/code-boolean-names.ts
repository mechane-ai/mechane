import { BOOLEAN_PREFIXES } from '@mechane/records';
import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * The prefixes that start a boolean's name: a predicate's, which the protocol's wire keys drop, and an option's. The
 * protocol declares the predicate prefixes because its wire keys need them at run time.
 */
const VALUES = {
  predicatePrefixes: BOOLEAN_PREFIXES,
  optionPrefixes: ['include', 'allow', 'skip', 'keep', 'use'],
} as const;

/** What enforces `code-boolean-names`: the prefixes the boolean-names rule reads. */
export const codeBooleanNames = {
  values: VALUES,
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'boolean-names',
      behavior: FixBehavior.BindingNames,
      standard: 'NM-07',
      violation: ['const paid = true;', 'type Mech = { readonly ready: boolean };'],
      allowed: ['const isPaid = true;', 'type Mech = { readonly isReady: boolean };'],
    },
  ],
} as const satisfies ContractEnforcement;

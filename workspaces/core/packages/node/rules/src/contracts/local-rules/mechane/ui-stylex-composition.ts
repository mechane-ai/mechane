import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Compiler-safe properties are static; composed refs, handlers, and styles also need built-browser review. */
export const uiStylexComposition = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'stylex-longhands',
      standard: '114',
      violation: [
        "const styles = stylex.create({ button: { border: '1px solid black' } });",
        "const styles = stylex.create({ button: { ':hover': { 'outline': '1px solid black' } } });",
        "const styles = stylex.create({ button: { outline: { default: '1px solid black', ':focus': '2px solid blue' } } });",
      ],
      allowed: [
        "const styles = stylex.create({ button: { borderWidth: 1, borderStyle: 'solid', borderColor: 'black' } });",
        "const options = { border: '1px solid black' };",
        "const styles = stylex.create({ outline: { borderWidth: 1, borderStyle: 'solid', borderColor: 'black' } });",
      ],
    },
  ],
} as const satisfies ContractEnforcement;

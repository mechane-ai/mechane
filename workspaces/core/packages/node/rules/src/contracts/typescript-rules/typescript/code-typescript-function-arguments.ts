import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-typescript-function-arguments`: one destructured object argument for each owned function. */
export const codeTypescriptFunctionArguments = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'object-arguments',
      standard: 'TD-01',
      violation: [
        'function parse(line: string, count: number) { return line; }',
        'function parse(input: ParseInput) { return input; }',
        'const clip = (text: string, max: number) => text.slice(0, max);',
        'const options = { cwd: WORKSPACE_FOLDER, exclude: (path) => isSkipped({ path }) };',
      ],
      allowed: [
        'function parse({ line }: ParseInput) { return line; }',
        'const isLate: (turn: Turn, nowMs: number) => boolean = (turn, nowMs) => turn.endsAtMs < nowMs;',
        'const options: GlobOptionsWithoutFileTypes = { cwd: WORKSPACE_FOLDER, exclude: (path) => isSkipped({ path }) };',
      ],
    },
  ],
} as const satisfies ContractEnforcement;

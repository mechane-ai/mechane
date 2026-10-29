import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-script-entry-points`: an executable exports nothing and keeps its work in `main`. */
export const codeScriptEntryPoints = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'script-exports',
      standard: 'ST-31',
      violation: ['export function main() { return 0; }', "export { main } from './run.ts';"],
      allowed: ['async function main() { await run(); }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'script-top-level',
      standard: 'ST-31',
      violation: ["console.log('start');", 'if (isReady) { start(); }'],
      allowed: ['await main();', 'main();'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'script-top-level-constants',
      standard: 'ST-31',
      violation: [
        'const settings = loadSettings();',
        'let attempt = 0;',
        "const ROOT = fileURLToPath(new URL('../', import.meta.url));",
      ],
      allowed: [
        "const PROGRAM = 'checks';",
        "const ROOT_URL = new URL('../', import.meta.url);",
        'const ROOT = fileURLToPath(ROOT_URL);',
        'const run = () => main();',
      ],
    },
  ],
} as const satisfies ContractEnforcement;

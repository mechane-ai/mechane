import { RuleTool } from '@mechane/rule-shapes';
import type { AstGrepRule } from '@mechane/rule-shapes';
import { posix } from 'node:path';
import { REGISTERED_RULES } from '../registered-rules.ts';
import type { GeneratedFile } from '../types.ts';
import { AST_GREP_TESTS, GENERATED_HEADER } from './constants.ts';
import { yamlScalar } from './yaml-scalar.ts';

/**
 * Each ast-grep rule's test, which `ast-grep test` runs: the rule must pass every allowed example of its registry entry
 * and flag every violation.
 */
export function astGrepTests(): ReadonlyArray<GeneratedFile> {
  const testFile: (rule: AstGrepRule) => GeneratedFile = ({ name, allowed, violation }) => {
    const exampleLine: (example: string) => string = (example) => `  - ${yamlScalar({ value: example })}`;

    const text = [
      GENERATED_HEADER,
      `id: ${name}`,
      'valid:',
      ...allowed.map(exampleLine),
      'invalid:',
      ...violation.map(exampleLine),
      '',
    ];

    return { path: posix.join(AST_GREP_TESTS, `${name}.yml`), text: text.join('\n') };
  };

  return REGISTERED_RULES.map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.AstGrep)
    .map(testFile);
}

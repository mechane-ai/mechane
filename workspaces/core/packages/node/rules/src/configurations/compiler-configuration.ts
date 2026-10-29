import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import { REGISTERED_RULES } from '../registered-rules.ts';
import type { GeneratedFile } from '../types.ts';
import { configurationText } from './configuration-text.ts';

/** `tsconfig.base.json`, which every member extends: the base options, then each strictness option the rules set. */
export function compilerConfiguration(): GeneratedFile {
  const options = REGISTERED_RULES.map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.Compiler)
    .filter(({ status }) => status !== RuleStatus.Proposed);

  const value = {
    compilerOptions: {
      ...CONTRACTS['code-typescript-compiler-strictness'].values.compilerOptions,
      ...Record.fromEntries(options.map(({ name, value: setting }) => [name, setting])),
    },
  };

  return {
    path: ConfigurationPath.Compiler,
    text: configurationText({ value, notes: [], expanded: [], syntax: Syntax.Json }),
  };
}

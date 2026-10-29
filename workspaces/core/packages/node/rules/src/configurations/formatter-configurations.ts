import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import type { GeneratedFile } from '../types.ts';
import { configurationText } from './configuration-text.ts';

/**
 * The product's `.oxfmtrc.json` and the factory's: the formatter's options, which the generator formats with too, and
 * what each skips. Both hold the same options, so a change of the line width reaches both.
 */
export function formatterConfigurations(): ReadonlyArray<GeneratedFile> {
  const { formatter, formatterIgnores, factoryFormatterIgnores } = CONTRACTS['code-comment-form'].values;

  const product = {
    $schema: './node_modules/oxfmt/configuration_schema.json',
    ...formatter,
    ignorePatterns: formatterIgnores,
  };

  const factory = {
    $schema: './workspaces/core/node_modules/oxfmt/configuration_schema.json',
    ...formatter,
    ignorePatterns: factoryFormatterIgnores,
  };

  return [
    {
      path: ConfigurationPath.Formatter,
      text: configurationText({ value: product, notes: [], expanded: [], syntax: Syntax.Json }),
    },
    {
      path: ConfigurationPath.FactoryFormatter,
      text: configurationText({ value: factory, notes: [], expanded: [], syntax: Syntax.Json }),
    },
  ];
}

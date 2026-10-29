/** The syntax a configuration's text takes: JSON, or a JavaScript object literal whose keys need no quotes. */
export const Syntax = { Json: 'json', JavaScript: 'javascript' } as const;

export type Syntax = (typeof Syntax)[keyof typeof Syntax];

/** The generated configurations, relative to the workspace. */
export const ConfigurationPath = {
  Oxlint: '.oxlintrc.json',
  Compiler: 'tsconfig.base.json',
  Cruiser: '.dependency-cruiser.cjs',
  Knip: 'knip.jsonc',
  Duplicates: '.jscpd.json',
  Formatter: '.oxfmtrc.json',
  FactoryFormatter: '../../.oxfmtrc.json',
} as const;

/** The folder of the registry's word lists, relative to the workspace: one sorted text file of words each. */
export const VOCABULARY_FOLDER = 'packages/node/rules/src/vocabulary';

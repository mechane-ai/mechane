import { astGrepConfiguration } from './ast-grep/ast-grep-configuration.ts';
import { astGrepTests } from './ast-grep/ast-grep-tests.ts';
import { astGrepUtilities } from './ast-grep/ast-grep-utilities.ts';
import { compilerConfiguration } from './configurations/compiler-configuration.ts';
import { duplicatesConfiguration } from './configurations/duplicates-configuration.ts';
import { formatterConfigurations } from './configurations/formatter-configurations.ts';
import { knipConfiguration } from './configurations/knip-configuration.ts';
import { laneCompilerConfigurations } from './configurations/lane-compiler-configurations.ts';
import { memberCompilerConfigurations } from './configurations/member-compiler-configurations.ts';
import { oxlintConfiguration } from './configurations/oxlint-configuration.ts';
import { strictGlobals } from './configurations/strict-globals.ts';
import { contractFile } from './contract-blocks/contract-file.ts';
import { contractNamesModule } from './contract-blocks/contract-names-module.ts';
import { cruiserConfiguration } from './cruiser/cruiser-configuration.ts';
import { gitAttributes } from './git-attributes.ts';
import type { ContractText, ExitStatus, GeneratedFile, WordLists, WorkspaceMember } from './types.ts';
import { wordListFiles } from './word-list-files.ts';

/** How a generated path below the factory but outside the workspace starts, whose attributes the factory sets. */
const OUTSIDE_WORKSPACE = '../';

/**
 * What the generator reads besides the registry: every contract, the word lists, the CLI's exit statuses and the
 * members `dependencies.json` declares.
 */
type GeneratedFilesInput = {
  readonly contracts: ReadonlyArray<ContractText>;
  readonly wordLists: WordLists;
  readonly exitStatuses: ReadonlyArray<ExitStatus>;
  readonly members: ReadonlyArray<WorkspaceMember>;
};

/**
 * The files the registry generates: the configurations, which the formatter lays out, and the files written as
 * rendered, each contract with its block and the attributes of every generated file.
 */
type GeneratedFiles = {
  readonly configurations: ReadonlyArray<GeneratedFile>;
  readonly verbatim: ReadonlyArray<GeneratedFile>;
};

/**
 * Every file the registry generates: the configurations, before the formatter lays them out, each contract with its
 * generated block, the sorted word lists, and the attributes that mark them all.
 */
export function generatedFiles({ contracts, wordLists, exitStatuses, members }: GeneratedFilesInput): GeneratedFiles {
  const configurations = [
    oxlintConfiguration({ contracts }),
    compilerConfiguration(),
    ...laneCompilerConfigurations({ members }),
    ...memberCompilerConfigurations({ members }),
    ...strictGlobals(),
    cruiserConfiguration({ members }),
    knipConfiguration({ members }),
    duplicatesConfiguration(),
    ...formatterConfigurations(),
    astGrepConfiguration({ contracts }),
    ...astGrepUtilities({ wordLists }),
    ...astGrepTests(),
    contractNamesModule({ contracts }),
  ];

  const isInWorkspace: (path: string) => boolean = (path) => !path.startsWith(OUTSIDE_WORKSPACE);
  const attributes = gitAttributes({ paths: configurations.map(({ path }) => path).filter(isInWorkspace) });

  return {
    configurations,
    verbatim: [
      ...contracts.flatMap((contract) => contractFile({ contract, exitStatuses })),
      ...wordListFiles({ wordLists }),
      attributes,
    ],
  };
}

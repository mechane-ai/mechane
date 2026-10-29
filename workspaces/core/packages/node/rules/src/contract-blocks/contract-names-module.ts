import type { ContractText, GeneratedFile } from '../types.ts';

/** The module of the registry that names every contract, relative to the workspace. */
const CONTRACT_NAMES_MODULE = 'packages/node/rule-shapes/src/contract-names.ts';

type ContractNamesModuleInput = { readonly contracts: ReadonlyArray<ContractText> };

/** The registry's `contract-names.ts`: the name of every contract folder, which the registry's entries must cover. */
export function contractNamesModule({ contracts }: ContractNamesModuleInput): GeneratedFile {
  const nameLine: (contract: ContractText) => string = ({ name }) => `  '${name}',`;
  const names = contracts.map(nameLine).join('\n');

  const text = [
    '/**',
    " * The name of every contract, its folder's without the number: the product's contracts in their order, Mechane's own,",
    " * then the factory's. `mise run fix` writes this file from the contract folders.",
    ' */',
    `export const CONTRACT_NAMES = [\n${names}\n] as const;`,
    '',
    '/** The name of a contract, such as `code-boolean-names`. */',
    'export type ContractName = (typeof CONTRACT_NAMES)[number];',
    '',
  ].join('\n');

  return { path: CONTRACT_NAMES_MODULE, text };
}

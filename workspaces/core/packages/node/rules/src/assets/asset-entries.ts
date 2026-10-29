import type { RegisteredRule } from '@mechane/rule-shapes';
import { Option } from 'effect';
import { posix } from 'node:path';
import { REGISTERED_RULES } from '../registered-rules.ts';
import type { AssetEntry, ContractText, LoadedAsset } from '../types.ts';
import { loadedAsset } from './loaded-asset.ts';

type AssetEntriesInput = { readonly contracts: ReadonlyArray<ContractText> };

/**
 * Each rule of the registry that loads an installed file in place, with the contract that ships the file and the file's
 * path relative to the workspace. They come in the order of the contract folders and their rules.
 */
export function assetEntries({ contracts }: AssetEntriesInput): ReadonlyArray<AssetEntry> {
  const contractEntries: (contract: ContractText) => ReadonlyArray<AssetEntry> = (contract) => {
    const folder = posix.dirname(contract.path);
    const isShipped: (registered: RegisteredRule) => boolean = (registered) => registered.contract === contract.name;

    const assetEntry: (loaded: LoadedAsset) => AssetEntry = ({ rule, asset }) => ({
      contract,
      rule,
      asset,
      path: posix.join(folder, asset.path),
    });

    const shippedEntries: (registered: RegisteredRule) => ReadonlyArray<AssetEntry> = ({ rule }) => {
      const loaded = loadedAsset({ rule });

      return Option.toArray(loaded).map(assetEntry);
    };

    return REGISTERED_RULES.filter(isShipped).flatMap(shippedEntries);
  };

  return contracts.flatMap(contractEntries);
}

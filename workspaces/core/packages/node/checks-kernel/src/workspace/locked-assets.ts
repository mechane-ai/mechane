import type { ContractLock } from '@mechane/rule-shapes';
import { Option, Record } from 'effect';
import { posix } from 'node:path';

/** The lock of the installed contracts. */
type LockedAssetsInput = { readonly lock: ContractLock };

/** One installed contract: its file's path from the factory's root, and the asset files it ships. */
type LockedContract = readonly [string, ContractLock['contracts'][string]];

/**
 * Every asset file the lock lists, by its path from the factory's root. These are the read-only tool files an installed
 * contract ships beside its `CONTRACT.md`, and `tenet validate` fails once a tool rewrites one.
 */
export function lockedAssets({ lock }: LockedAssetsInput): ReadonlySet<string> {
  const contractAssets: (contract: LockedContract) => ReadonlyArray<string> = ([path, { files }]) => {
    const folder = posix.dirname(path);
    const listed = Option.map(files, Record.keys);
    const assets = Option.getOrElse(listed, () => []);

    return assets.map((asset) => posix.join(folder, asset));
  };

  const contracts = Record.toEntries(lock.contracts);
  const paths = contracts.flatMap(contractAssets);

  return new Set(paths);
}

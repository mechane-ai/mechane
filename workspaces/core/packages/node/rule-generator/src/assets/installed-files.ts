import type { ContractLock } from '@mechane/rule-shapes';
import type { ContractText } from '@mechane/rules';
import { Option, Record } from 'effect';
import { posix } from 'node:path';

/** The workspace's folder, relative to the factory's root, where `.tenet.lock` names each contract's file. */
const WORKSPACE_IN_FACTORY = 'workspaces/core';

/** The lock of the installed contracts, and one contract. */
type InstalledFilesInput = { readonly lock: ContractLock; readonly contract: ContractText };

/**
 * The asset files `.tenet.lock` lists for a contract, each by its path from the contract's folder with its hash; none
 * for a local contract.
 */
export function installedFiles({ lock, contract }: InstalledFilesInput): Readonly<Record<string, string>> {
  const key = posix.join(WORKSPACE_IN_FACTORY, contract.path);
  const installed = Record.get(lock.contracts, key);
  const files = Option.flatMap(installed, ({ files: listed }) => listed);

  return Option.getOrElse(files, Record.empty);
}

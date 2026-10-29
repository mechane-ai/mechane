import type { ContractText } from '@mechane/rules';
import { Array, Effect } from 'effect';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readInput } from './read-input.ts';

/** The contract folders, relative to the workspace, whose names the generated contract names list in this order. */
const CONTRACT_FOLDERS = ['.contracts', '../../.contracts'] as const;

/** A contract's folder name: its number, then its name, such as `027-code-boolean-names`. */
const CONTRACT_FOLDER = /^\d{3}-[a-z0-9-]+$/;

/** The file of a contract in its folder. */
const CONTRACT_FILE = 'CONTRACT.md';

/** The number that starts a contract's folder name, before the contract's name. */
const CONTRACT_NUMBER = /^\d{3}-/;

type ContractPlacesInput = { readonly folder: string };

/** A contract's name, its folder's without the number, and the path of its file relative to the workspace. */
type ContractPlace = { readonly name: string; readonly path: string };

/** Every contract of the product's folder and then the factory's, each folder sorted: its name, file and text. */
export const readContracts = Effect.fn('readContracts')(function* (): Effect.fn.Return<
  ReadonlyArray<ContractText>,
  GenerateFailed
> {
  const listings = yield* Effect.forEach(CONTRACT_FOLDERS, (folder) => contractPlaces({ folder }), { concurrency: 1 });
  const places = listings.flat();
  const texts = yield* Effect.forEach(places, ({ path }) => readInput({ path }), { concurrency: 1 });

  return Array.zip(places, texts).map(([{ name, path }, text]) => ({ name, path, text }));
});

/** The contracts of one folder, sorted: each one's name, its folder's without the number, and its file's path. */
const contractPlaces = Effect.fn('contractPlaces')(function* ({
  folder,
}: ContractPlacesInput): Effect.fn.Return<ReadonlyArray<ContractPlace>, GenerateFailed> {
  const absolute = join(WORKSPACE_FOLDER, folder);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(absolute),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path: folder, reason: String(cause) }),
  });

  const contractPlace: (entry: string) => ContractPlace = (entry) => ({
    name: entry.replace(CONTRACT_NUMBER, ''),
    path: join(folder, entry, CONTRACT_FILE),
  });

  return entries
    .filter((entry) => CONTRACT_FOLDER.test(entry))
    .toSorted()
    .map(contractPlace);
});

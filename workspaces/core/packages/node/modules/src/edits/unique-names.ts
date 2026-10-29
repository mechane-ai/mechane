import type { ModuleName } from '../types.ts';

type UniqueNamesInput = { readonly names: ReadonlyArray<ModuleName> };

/** Each name once by the name it binds, the last of its takes winning. */
export function uniqueNames({ names }: UniqueNamesInput): ReadonlyArray<ModuleName> {
  return [...new Map(names.map((name) => [name.local, name])).values()];
}

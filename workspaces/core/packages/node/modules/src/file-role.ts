import { Array, Option, Schema } from 'effect';
import { basename } from 'node:path';
import { RoleFile, TYPESCRIPT_EXTENSION } from './constants.ts';

type PathInput = { readonly path: string };

/** The role a role file's stem names, as `types` for `types.ts` and `drones.types.ts`; none for a behavior file. */
export function fileRole({ path }: PathInput): Option.Option<RoleFile> {
  return Option.filter(Array.last(basename(path, TYPESCRIPT_EXTENSION).split('.')), Schema.is(Schema.Enum(RoleFile)));
}

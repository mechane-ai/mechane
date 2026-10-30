import { Effect } from 'effect';
import type { Cause } from 'effect';
import { dirname, resolve } from 'node:path';
import { WRANGLER_CONFIGURATION } from './constants.ts';
import { readJsonc } from './read-jsonc.ts';
import { BaseConfiguration } from './schemas.ts';
import type { ProgramFailureInput } from './types.ts';

/** A configuration, and the path of the built bundle it serves. */
type BuiltBundleInput<C> = { readonly configuration: C; readonly main: string };

/** The keys that make Wrangler or celld serve `main` as it is built. */
type BuiltBundle = { readonly main: string; readonly no_bundle: true };

/** One `containers` entry of the configuration. */
type ContainerEntry = BaseConfiguration['containers'][number];

/**
 * Container keys are limited to those celld accepts. Absolute image paths keep staged local configurations pointed at
 * the same Dockerfile and build folder. Reads fail as the caller's failure at its requested step.
 */
export const baseConfiguration = Effect.fn('baseConfiguration')(function* <S, E extends Cause.YieldableError>({
  step,
  failure,
}: ProgramFailureInput<S, E>): Effect.fn.Return<BaseConfiguration, E> {
  const options = { onExcessProperty: 'error' } as const;
  const base = yield* readJsonc({ path: WRANGLER_CONFIGURATION, schema: BaseConfiguration, options, step, failure });
  const folder = dirname(WRANGLER_CONFIGURATION);

  const resolvedEntry: (entry: ContainerEntry) => ContainerEntry = (entry) => ({
    ...entry,
    image: resolve(folder, entry.image),
  });

  return { ...base, containers: base.containers.map(resolvedEntry) };
});

/** A configuration whose `main` names a bundle that is already built, which Wrangler and celld then serve unchanged. */
export function withBuiltBundle<C extends object>({ configuration, main }: BuiltBundleInput<C>): C & BuiltBundle {
  // Wrangler fixes the key's name, `no_bundle`.
  return { ...configuration, main, no_bundle: true };
}

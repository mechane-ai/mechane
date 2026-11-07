import { Effect } from 'effect';
import type { Cause } from 'effect';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonc } from './read-jsonc.ts';
import { BaseConfiguration } from './schemas.ts';
import type { ProgramFailureInput } from './types.ts';

/** The build configuration also supplies local runtime settings and release metadata. */
const WRANGLER_URL: Readonly<URL> = new URL('../../../worker/sandbox-service/wrangler.jsonc', import.meta.url);
const WRANGLER_CONFIGURATION = fileURLToPath(WRANGLER_URL);

/** One `containers` entry of the configuration. */
type ContainerEntry = BaseConfiguration['containers'][number];

/**
 * Absolute image paths keep staged configurations pointed at the release's Dockerfile and build folder. Reads fail as
 * the caller's failure at its requested step.
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

import { join } from 'node:path';
import type { GuestSettings } from '../types.ts';

type CacheEnvironmentInput = Pick<GuestSettings, 'scratchDirectory'>;

/** Declared reconstructible downloads and tool installs stay outside the durable home. */
export function cacheEnvironment({ scratchDirectory }: CacheEnvironmentInput): Readonly<Record<string, string>> {
  const cache = join(scratchDirectory, 'cache');

  return {
    MECHANE_CACHE_HOME: cache,
    XDG_CACHE_HOME: cache,
    npm_config_cache: join(cache, 'npm'),
    pnpm_config_cache_dir: join(cache, 'pnpm-cache'),
    pnpm_config_store_dir: join(cache, 'pnpm-store'),
    UV_CACHE_DIR: join(cache, 'uv'),
    PIP_CACHE_DIR: join(cache, 'pip'),
    MISE_CACHE_DIR: join(cache, 'mise-cache'),
    MISE_DATA_DIR: join(cache, 'mise-data'),
    MISE_STATE_DIR: join(cache, 'mise-state'),
    MISE_TMP_DIR: scratchDirectory,
    GOCACHE: join(cache, 'go-build'),
    TMPDIR: scratchDirectory,
  };
}

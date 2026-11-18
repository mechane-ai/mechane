import { writeDiagnostic } from '@mechane/program';
import { GuestScope } from '@mechane/sandbox-wire';
import { Effect, Option } from 'effect';
import { lstatSync } from 'node:fs';
import { mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { GuestMisconfigured } from '../errors.ts';
import type { GuestSettings } from '../types.ts';

const CONTAINER_CACHE = '/tmp/mechane/cache';

/** Tools using the conventional cache path share machine-local storage. An existing home entry belongs to its owner. */
export const prepareHomeCache = Effect.fn('prepareHomeCache')(function* ({
  home,
  scope,
}: Pick<GuestSettings, 'home' | 'scope'>): Effect.fn.Return<void> {
  if (scope !== GuestScope.Container) {
    return;
  }

  const setup = linkHomeCache({ home });

  yield* setup.pipe(
    Effect.catchTags({
      GuestMisconfigured: ({ reason }) =>
        Effect.sync(() => {
          writeDiagnostic({ program: 'mechane-guest', line: `Could not prepare the optional home cache: ${reason}` });
        }),
    }),
  );
});

const linkHomeCache = Effect.fn('linkHomeCache')(function* ({
  home,
}: Pick<GuestSettings, 'home'>): Effect.fn.Return<void, GuestMisconfigured> {
  const link = join(home, '.cache');

  yield* Effect.tryPromise({
    try: () => mkdir(CONTAINER_CACHE, { recursive: true, mode: 0o700 }),
    catch: (cause) => new GuestMisconfigured({ reason: String(cause) }),
  });

  const entry = yield* Effect.try({
    try: () => lstatSync(link, { throwIfNoEntry: false }),
    catch: (cause) => new GuestMisconfigured({ reason: String(cause) }),
  });

  const existing = Option.fromUndefinedOr(entry);

  if (Option.isSome(existing)) {
    return;
  }

  yield* Effect.tryPromise({
    try: () => symlink(CONTAINER_CACHE, link),
    catch: (cause) => new GuestMisconfigured({ reason: String(cause) }),
  });
});

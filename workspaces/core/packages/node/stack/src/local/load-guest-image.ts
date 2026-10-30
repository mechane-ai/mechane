import { finishedProcess } from '@mechane/program';
import { Duration, Effect } from 'effect';
import { join } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackSettings } from '../types.ts';
import { LOCAL_PACKAGE_FILES } from './constants.ts';

type LoadGuestImageInput = { readonly settings: StackSettings };
const LOAD_TIMEOUT = Duration.minutes(5);

/** Imports the verified guest archive into the user's existing Docker engine. */
export const loadGuestImage = Effect.fn('loadGuestImage')(function* ({
  settings,
}: LoadGuestImageInput): Effect.fn.Return<void, StackFailed> {
  const archive = join(settings.executableFolder, LOCAL_PACKAGE_FILES.guest);

  yield* finishedProcess({
    command: 'docker',
    args: ['load', '--input', archive],
    environment: settings.inherited,
    timeout: LOAD_TIMEOUT,
  }).pipe(Effect.mapError(({ reason }) => new StackFailed({ step: StackStep.LoadGuestImage, reason })));
});

import { CredentialsFailed } from '@mechane/cli-kernel';
import { PrivateMode, replaceFile } from '@mechane/program';
import { Effect, Option } from 'effect';

type WritePrivateFileInput = { readonly path: string; readonly text: string };

/** Replaces a file at once with text only its owner may read, so a reader never sees a partial file. */
export const writePrivateFile = Effect.fn('writePrivateFile')(function* ({
  path,
  text,
}: WritePrivateFileInput): Effect.fn.Return<void, CredentialsFailed> {
  yield* replaceFile({ path, contents: text, mode: PrivateMode.File, accept: Option.none() }).pipe(
    Effect.mapError(({ step, path: failedPath, reason }) => new CredentialsFailed({ step, path: failedPath, reason })),
  );
});

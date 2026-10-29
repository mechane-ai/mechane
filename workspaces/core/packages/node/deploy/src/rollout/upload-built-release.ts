import { DeployFailed } from '@mechane/deploy-kernel';
import type { UploadSettings } from '@mechane/deploy-kernel';
import { RELEASE_BUILD_FOLDER, uploadRelease } from '@mechane/release';
import { Effect } from 'effect';

type UploadSettingsInput = { readonly settings: UploadSettings };

/**
 * Uploads the release folder to the releases bucket the Wrangler configuration names, with the operator's Cloudflare
 * variables from the program's environment; the production upload belongs to the deploy program.
 */
export const uploadBuiltRelease = Effect.fn('uploadBuiltRelease')(function* ({
  settings,
}: UploadSettingsInput): Effect.fn.Return<void, DeployFailed> {
  const bucket = settings.installation.r2_buckets[0].bucket_name;
  const inherited = { ...settings.inherited, ...settings.cloudflare };

  yield* uploadRelease({ directory: RELEASE_BUILD_FOLDER, bucket, inherited }).pipe(
    Effect.mapError(({ step, subjects, reason }) => new DeployFailed({ step, subjects, reason })),
  );
});

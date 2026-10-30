import { Effect } from 'effect';
import type { DistributionFailed } from '../errors.ts';
import type { DistributionInput, PreviewResult } from '../types.ts';
import { installationManifest } from './installation-manifest.ts';
import { stageModule } from './stage-module.ts';

const PREVIEW_COMMIT = '0000000000000000000000000000000000000000';
const PREVIEW_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';
const PREVIEW_DIGEST = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

/** Stages a module for offline validation with explicit preview metadata and no publishable artifact receipt. */
export const previewModule = Effect.fn('previewModule')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<PreviewResult, DistributionFailed> {
  const manifest = yield* installationManifest({
    commit: PREVIEW_COMMIT,
    isPreview: true,
    guest: { sha256: PREVIEW_SHA256, bytes: 1, digest: PREVIEW_DIGEST },
  });

  yield* stageModule({ folder: settings.folder, manifest });

  return { folder: settings.folder, is_preview: true };
});

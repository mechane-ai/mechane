import { RELEASE } from '@mechane/protocol';
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DistributionStep, PUBLIC_REPOSITORY } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { writeDocument } from '../files/write-document.ts';
import type { Artifact, ArtifactReceipt } from '../schemas.ts';

type ReceiptInput = { readonly folder: string; readonly commit: string; readonly assets: ReadonlyArray<Artifact> };

/** Records each immutable asset checksum and the public commit after all build steps finish. */
export const writeReceipt = Effect.fn('writeReceipt')(function* ({
  folder,
  commit,
  assets,
}: ReceiptInput): Effect.fn.Return<ArtifactReceipt, DistributionFailed> {
  const checksumLine: (asset: Artifact) => string = (asset) => `${asset.sha256}  ${asset.name}\n`;
  const checksumLines = assets.map(checksumLine);
  const text = checksumLines.join('');
  const checksumPath = join(folder, 'SHA256SUMS');

  yield* Effect.tryPromise({
    try: () => writeFile(checksumPath, text, { flag: 'wx' }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  const checksum = yield* fileDigest({ path: checksumPath });

  const receipt: ArtifactReceipt = {
    format_version: 1,
    version: RELEASE,
    repository: PUBLIC_REPOSITORY,
    public_commit: commit,
    assets: [...assets, { name: 'SHA256SUMS', ...checksum }],
  };

  const path = join(folder, 'artifacts.json');

  yield* writeDocument({ path, document: receipt });

  return receipt;
});

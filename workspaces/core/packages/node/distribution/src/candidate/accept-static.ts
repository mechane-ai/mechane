import { sha256Hex } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DistributionStep, QUALIFICATION_FORMAT_VERSION } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { writeDocument } from '../files/write-document.ts';
import type { DistributionInput } from '../types.ts';
import {
  runStaticAndFormatChecks,
  verifyAcceptanceCandidate,
  verifyCandidateUnchanged,
  withExtractedModule,
} from './candidate-context.ts';
import { FORMATS_LOG_NAME, STATIC_LOG_NAME, STATIC_RECEIPT_NAME, StaticReceipt } from './shard-schema.ts';

/** Runs static, infrastructure, and shipped-format checks in parallel with smoke shards and seals their receipt. */
export const acceptStatic = Effect.fn('acceptStatic')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<StaticReceipt, DistributionFailed> {
  const candidate = yield* verifyAcceptanceCandidate({ settings, scope: 'core' });

  const logs = yield* Effect.tryPromise({
    try: () =>
      withExtractedModule({
        settings,
        manifest: candidate.manifest,
        release: candidate.release,
        run: async ({ temporary, module }) => await runStaticAndFormatChecks({ settings, module, temporary }),
      }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  const staticEntry = logs.find(({ name }) => name === STATIC_LOG_NAME);
  const formatsEntry = logs.find(({ name }) => name === FORMATS_LOG_NAME);

  if (staticEntry === undefined || formatsEntry === undefined) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'static qualification did not produce both static and shipped-format logs',
    });
  }

  const { artifacts, installation } = yield* verifyCandidateUnchanged({ settings, candidate, scope: 'core' });

  yield* Effect.tryPromise({
    try: () => writeFile(join(settings.folder, STATIC_LOG_NAME), staticEntry.contents, { flag: 'wx' }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  yield* Effect.tryPromise({
    try: () => writeFile(join(settings.folder, FORMATS_LOG_NAME), formatsEntry.contents, { flag: 'wx' }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  const receipt = yield* Schema.decodeUnknownEffect(StaticReceipt)({
    format_version: QUALIFICATION_FORMAT_VERSION,
    public_commit: candidate.source,
    artifacts: { path: 'artifacts.json', ...artifacts },
    installation: { path: 'installation.json', ...installation },
    worker_sha256: candidate.manifest.worker.sha256,
    static_log_file: STATIC_LOG_NAME,
    static_log_sha256: sha256Hex({ contents: staticEntry.contents }),
    formats_log_file: FORMATS_LOG_NAME,
    formats_log_sha256: sha256Hex({ contents: formatsEntry.contents }),
  }).pipe(Effect.mapError((cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) })));

  yield* writeDocument({ path: join(settings.folder, STATIC_RECEIPT_NAME), document: receipt });

  return receipt;
});

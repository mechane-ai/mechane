import { sha256Hex } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CONSOLE_SHARD,
  CORE_FOLDER,
  DistributionStep,
  QUALIFICATION_FORMAT_VERSION,
  QUALIFICATION_SHARDS,
} from '../constants.ts';
import type { QualificationShard } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { writeDocument } from '../files/write-document.ts';
import type { DistributionInput } from '../types.ts';
import {
  executeDistributionCommand,
  inspectQualificationTools,
  prepareQualificationGuest,
  sanitizeCandidateLog,
  verifyAcceptanceCandidate,
  verifyCandidateUnchanged,
  withExtractedModule,
} from './candidate-context.ts';
import { shardLogName, ShardReceipt, shardReceiptName, ShardSummary } from './shard-schema.ts';

const SHARD_SUMMARY_PREFIX = 'SMOKE_SHARD_SUMMARY ';
const ShardName = Schema.Literals(QUALIFICATION_SHARDS);

/** Runs one qualification shard over an immutable candidate and writes its signed shard receipt. */
export const acceptShard = Effect.fn('acceptShard')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ShardReceipt, DistributionFailed> {
  const shard: QualificationShard = yield* Schema.decodeUnknownEffect(ShardName)(settings.shardTarget).pipe(
    Effect.mapError(
      () =>
        new DistributionFailed({
          step: DistributionStep.Settings,
          reason: `select one qualification shard from ${QUALIFICATION_SHARDS.join(', ')}`,
        }),
    ),
  );

  const candidate = yield* verifyAcceptanceCandidate({ settings });

  const execution = yield* Effect.tryPromise({
    try: () =>
      withExtractedModule({
        settings,
        manifest: candidate.manifest,
        release: candidate.release,
        run: async ({ temporary, module }) => {
          if (shard === CONSOLE_SHARD) {
            await executeDistributionCommand({
              settings,
              command: 'mise',
              args: ['-C', CORE_FOLDER, 'run', 'browser:install'],
            });
          }

          const tools = await inspectQualificationTools({ settings });

          const { guestImageId, guestImageLog, cli } = await prepareQualificationGuest({
            settings,
            receipt: candidate.receipt,
            manifest: candidate.manifest,
          });

          const smoke = await executeDistributionCommand({
            settings,
            command: settings.nodeExecutable,
            args: [
              join(CORE_FOLDER, 'packages/node/smoke/src/main.ts'),
              '--shard',
              shard,
              '--artifact-directory',
              module,
              '--guest-image',
              guestImageId,
              '--cli-executable',
              join(settings.folder, cli),
            ],
          });

          const line = smoke.split('\n').find((entry) => entry.startsWith(SHARD_SUMMARY_PREFIX));

          if (line === undefined) {
            throw new Error(`Qualification shard ${shard} did not emit a completion summary`);
          }

          const summary = Schema.decodeUnknownSync(Schema.fromJsonString(ShardSummary))(
            line.slice(SHARD_SUMMARY_PREFIX.length),
          );

          if (summary.shard !== shard || summary.count !== summary.guarantees.length) {
            throw new Error(`Qualification shard ${shard} summary is inconsistent`);
          }

          return {
            tools,
            cli,
            guestImageLog: sanitizeCandidateLog({ contents: guestImageLog, temporary }),
            log: sanitizeCandidateLog({ contents: smoke, temporary }),
            catalog: { count: summary.count, guarantees: summary.guarantees },
          };
        },
      }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  const { artifacts, installation } = yield* verifyCandidateUnchanged({ settings, candidate });
  const logFile = shardLogName({ shard });

  yield* Effect.tryPromise({
    try: () => writeFile(join(settings.folder, logFile), execution.log, { flag: 'wx' }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  const receipt = yield* Schema.decodeUnknownEffect(ShardReceipt)({
    format_version: QUALIFICATION_FORMAT_VERSION,
    shard,
    public_commit: candidate.source,
    artifacts: { path: 'artifacts.json', ...artifacts },
    installation: { path: 'installation.json', ...installation },
    worker_sha256: candidate.manifest.worker.sha256,
    guest_image: candidate.manifest.guest.digest,
    guest_image_log: execution.guestImageLog,
    cli: execution.cli,
    tools: execution.tools,
    catalog: execution.catalog,
    log_file: logFile,
    log_sha256: sha256Hex({ contents: execution.log }),
  }).pipe(Effect.mapError((cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) })));

  yield* writeDocument({ path: join(settings.folder, shardReceiptName({ shard })), document: receipt });

  return receipt;
});

import { sha256Hex } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CONSOLE_SHARD,
  CONTAINER_FREE_SHARDS,
  CORE_FOLDER,
  DistributionStep,
  QUALIFICATION_FORMAT_VERSION,
  QUALIFICATION_SHARDS,
} from '../constants.ts';
import type { QualificationShard } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { writeDocument } from '../files/write-document.ts';
import type { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionInput, DistributionSettings, VerificationScope } from '../types.ts';
import {
  executeDistributionCommand,
  inspectQualificationTools,
  prepareQualificationGuest,
  resolveHostCliBinary,
  sanitizeCandidateLog,
  verifyAcceptanceCandidate,
  verifyCandidateUnchanged,
  withExtractedModule,
} from './candidate-context.ts';
import { shardLogName, ShardReceipt, shardReceiptName, ShardSummary } from './shard-schema.ts';

const SHARD_SUMMARY_PREFIX = 'SMOKE_SHARD_SUMMARY ';
const ShardName = Schema.Literals(QUALIFICATION_SHARDS);

type ShardRuntimeInput = {
  readonly isContainerFree: boolean;
  readonly settings: DistributionSettings;
  readonly receipt: ArtifactReceipt;
  readonly manifest: InstallationManifest;
};

type ShardRuntime = { readonly guestImageId: string | undefined; readonly guestImageLog: string; readonly cli: string };

function shardVerificationScope(isContainerFree: boolean): VerificationScope {
  if (isContainerFree) {
    return 'core';
  }

  return 'runtime';
}

async function prepareShardRuntime({
  isContainerFree,
  settings,
  receipt,
  manifest,
}: ShardRuntimeInput): Promise<ShardRuntime> {
  if (isContainerFree) {
    return { guestImageId: undefined, guestImageLog: '', cli: resolveHostCliBinary({ receipt }) };
  }

  return await prepareQualificationGuest({ settings, receipt, manifest });
}

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

  const isContainerFree = CONTAINER_FREE_SHARDS.has(shard);
  const scope = shardVerificationScope(isContainerFree);
  const candidate = yield* verifyAcceptanceCandidate({ settings, scope });

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

          const guest = await prepareShardRuntime({
            isContainerFree,
            settings,
            receipt: candidate.receipt,
            manifest: candidate.manifest,
          });

          const smokeArgs = [
            join(CORE_FOLDER, 'packages/node/smoke/src/main.ts'),
            '--shard',
            shard,
            '--artifact-directory',
            module,
            '--cli-executable',
            join(settings.folder, guest.cli),
          ];

          if (guest.guestImageId !== undefined) {
            smokeArgs.push('--guest-image', guest.guestImageId);
          }

          const smoke = await executeDistributionCommand({
            settings,
            command: settings.nodeExecutable,
            args: smokeArgs,
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
            cli: guest.cli,
            guestImageLog: sanitizeCandidateLog({ contents: guest.guestImageLog, temporary }),
            log: sanitizeCandidateLog({ contents: smoke, temporary }),
            catalog: { count: summary.count, guarantees: summary.guarantees },
          };
        },
      }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  const { artifacts, installation } = yield* verifyCandidateUnchanged({ settings, candidate, scope });
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

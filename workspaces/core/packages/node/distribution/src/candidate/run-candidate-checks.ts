import { Schema } from 'effect';
import { join } from 'node:path';
import { CORE_FOLDER } from '../constants.ts';
import type { RuntimeRelease } from '../runtime-artifact.ts';
import type { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import {
  executeDistributionCommand,
  inspectQualificationTools,
  prepareQualificationGuest,
  runStaticAndFormatChecks,
  sanitizeCandidateLog,
  withExtractedModule,
} from './candidate-context.ts';
import { CatalogSummary } from './shard-schema.ts';
import type { CandidateChecks, CandidateLog } from './shard-schema.ts';

const SUMMARY_PREFIX = 'SMOKE_CATALOG_SUMMARY ';

type CandidateChecksInput = {
  readonly settings: DistributionSettings;
  readonly receipt: ArtifactReceipt;
  readonly manifest: InstallationManifest;
  readonly release: RuntimeRelease;
};

/** Exercises the built bytes through the same native stack and catalog used during development. */
export async function runCandidateChecks({
  settings,
  receipt,
  manifest,
  release,
}: CandidateChecksInput): Promise<CandidateChecks> {
  return await withExtractedModule({
    settings,
    manifest,
    release,
    run: async ({ temporary, module }) => {
      const staticLogs = await runStaticAndFormatChecks({ settings, module, temporary });

      await executeDistributionCommand({
        settings,
        command: 'mise',
        args: ['-C', CORE_FOLDER, 'run', 'browser:install'],
      });

      const tools = await inspectQualificationTools({ settings });
      const { guestImageId, guestImageLog, cli } = await prepareQualificationGuest({ settings, receipt, manifest });

      const smoke = await executeDistributionCommand({
        settings,
        command: settings.nodeExecutable,
        args: [
          join(CORE_FOLDER, 'packages/node/smoke/src/main.ts'),
          '--artifact-directory',
          module,
          '--guest-image',
          guestImageId,
          '--cli-executable',
          join(settings.folder, cli),
        ],
      });

      const summary = smoke.split('\n').find((line) => line.startsWith(SUMMARY_PREFIX));

      if (summary === undefined) {
        throw new Error('The complete artifact catalog did not report success');
      }

      const catalog = Schema.decodeUnknownSync(Schema.fromJsonString(CatalogSummary))(
        summary.slice(SUMMARY_PREFIX.length),
      );

      if (catalog.count !== catalog.guarantees.length || new Set(catalog.guarantees).size !== catalog.count) {
        throw new Error('The artifact catalog summary is incomplete');
      }

      const logs: ReadonlyArray<CandidateLog> = [
        ...staticLogs,
        {
          name: 'qualification-guest-image.log',
          contents: sanitizeCandidateLog({ contents: guestImageLog, temporary }),
        },
        {
          name: 'qualification-artifact-scenarios.log',
          contents: sanitizeCandidateLog({ contents: smoke, temporary }),
        },
      ];

      return { logs, catalog, guestImage: manifest.guest.digest, cli, tools };
    },
  });
}

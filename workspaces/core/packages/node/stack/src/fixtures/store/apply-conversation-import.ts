import {
  MECH_MAINTENANCE_PATH,
  MechMaintenanceAction,
  MechMaintenanceReceipt,
  MechMaintenanceRequest,
  MechRuntimeStatus,
} from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConversationImportScope, Environment } from '../../types.ts';
import type { HistoricalConversationFixture } from './conversation-import.ts';

type FixtureProgramInput = {
  readonly name: 'migrate' | 'import';
  readonly arguments: ReadonlyArray<string>;
  readonly environment: Environment;
};

type ApplyConversationImportInput = ConversationImportScope & {
  readonly fixture: HistoricalConversationFixture;
  readonly origin: URL;
  readonly bearer: string;
  readonly directory: string;
  readonly runProgram: (input: FixtureProgramInput) => Promise<string>;
};

const ImportPlan = Schema.Struct({ digest: Schema.String });
const PRIVATE_FILE_MODE = 0o600;
const MAINTENANCE_TIMEOUT_MS = 30_000;

export async function applyConversationImport(input: ApplyConversationImportInput): Promise<void> {
  const environment = {
    MECHANE_MIGRATION_DATABASE_URL: input.fixture.sourceDatabaseUrl,
    MECHANE_ORIGIN: input.origin.origin,
    MECHANE_SANDBOX_SERVICE_KEY: input.bearer,
  };

  await input.runProgram({ name: 'migrate', arguments: [], environment });

  const request = Schema.decodeUnknownSync(MechMaintenanceRequest)({
    workspaceId: input.workspaceId,
    mechId: input.mechId,
    action: MechMaintenanceAction.Quiesce,
  });

  const quiesced = await fetch(new URL(MECH_MAINTENANCE_PATH, input.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${input.bearer}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify(Schema.encodeSync(MechMaintenanceRequest)(request)),
    signal: AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS),
  });

  if (!quiesced.ok) {
    throw new Error(`The frozen conversation target refused quiescence (${quiesced.status})`);
  }

  const maintenance = Schema.decodeUnknownSync(MechMaintenanceReceipt)(await quiesced.json());

  if (
    maintenance.status !== MechRuntimeStatus.Quiesced ||
    maintenance.pendingNativeTaskCount !== 0 ||
    maintenance.pendingEffectCount !== 0
  ) {
    throw new Error('The frozen conversation target has active execution');
  }

  const selection = ['--workspace', input.workspaceId, '--mech', input.mechId];
  const dryRun = await input.runProgram({ name: 'import', arguments: ['--dry-run', ...selection], environment });
  const plan = Schema.decodeUnknownSync(Schema.fromJsonString(ImportPlan))(dryRun);
  const evidenceFile = join(input.directory, `${input.fixture.sourceDatabaseName}.retirement.json`);
  const evidence = JSON.stringify(input.fixture.retirementEvidence);
  const evidenceSha256 = createHash('sha256').update(evidence).digest('hex');

  await writeFile(evidenceFile, evidence, { mode: PRIVATE_FILE_MODE });

  const applyArguments = [
    '--apply',
    ...selection,
    '--expect-digest',
    plan.digest,
    '--retirement-receipt',
    evidenceFile,
    '--retirement-sha256',
    evidenceSha256,
  ];

  await assert.rejects(
    input.runProgram({
      name: 'import',
      arguments: applyArguments,
      environment: { ...environment, MECHANE_ORIGIN: 'http://import.example.invalid', MECHANE_SANDBOX_SERVICE_KEY: '' },
    }),
    /MECHANE_ORIGIN must be a bare HTTPS origin or a loopback HTTP origin with a port/u,
  );

  await input.runProgram({ name: 'import', arguments: applyArguments, environment });
}

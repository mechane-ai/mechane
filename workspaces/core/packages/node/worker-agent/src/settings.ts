import { SandboxEvidenceKind } from '@mechane/sandbox-provider';
import { Schema } from 'effect';
import type { DirectEvidenceUploadInput } from './evidence-upload.ts';
import type { AssignedWorkerLease } from './run-worker-agent.ts';
import { decodeWorkSecretToken } from './run-worker-agent.ts';

type WorkerEnvironmentMap = Readonly<Record<string, string | undefined>>;

function requiredSetting(environment: WorkerEnvironmentMap, name: string): string {
  const value = environment[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing worker-agent environment variable ${name}`);
  }

  return value;
}

function optionalIntegerSetting(environment: WorkerEnvironmentMap, name: string): number | undefined {
  const raw = environment[name];

  if (raw === undefined || raw.length === 0) {
    return undefined;
  }

  const parsed = Number(raw);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer worker-agent environment variable ${name}`);
  }

  return parsed;
}

export type WorkerAgentMode =
  | { readonly kind: 'work'; readonly lease: AssignedWorkerLease }
  | { readonly kind: 'upload-evidence'; readonly upload: DirectEvidenceUploadInput };

export function loadWorkerAgentSettings(environment: WorkerEnvironmentMap = process.env): WorkerAgentMode {
  const apiOrigin = requiredSetting(environment, 'MECHANE_API_ORIGIN');
  const sessionId = requiredSetting(environment, 'MECHANE_SESSION_ID');
  const workSecret = requiredSetting(environment, 'MECHANE_WORK_SECRET');
  const evidencePath = environment['MECHANE_UPLOAD_EVIDENCE_PATH'];

  if (evidencePath !== undefined && evidencePath.length > 0) {
    const artifactId = requiredSetting(environment, 'MECHANE_UPLOAD_EVIDENCE_ARTIFACT_ID');

    const kind = Schema.decodeUnknownSync(SandboxEvidenceKind)(
      requiredSetting(environment, 'MECHANE_UPLOAD_EVIDENCE_KIND'),
    );

    const mediaType = requiredSetting(environment, 'MECHANE_UPLOAD_EVIDENCE_MEDIA_TYPE');

    return {
      kind: 'upload-evidence',
      upload: {
        apiOrigin,
        sessionId,
        artifactId,
        sessionToken: decodeWorkSecretToken(workSecret),
        filePath: evidencePath,
        kind,
        mediaType,
        turnId: environment['MECHANE_UPLOAD_EVIDENCE_TURN_ID'],
        width: optionalIntegerSetting(environment, 'MECHANE_UPLOAD_EVIDENCE_WIDTH'),
        height: optionalIntegerSetting(environment, 'MECHANE_UPLOAD_EVIDENCE_HEIGHT'),
        durationMs: optionalIntegerSetting(environment, 'MECHANE_UPLOAD_EVIDENCE_DURATION_MS'),
      },
    };
  }

  return {
    kind: 'work',
    lease: {
      apiOrigin,
      environmentId: requiredSetting(environment, 'MECHANE_ENVIRONMENT_ID'),
      sessionId,
      workId: requiredSetting(environment, 'MECHANE_WORK_ID'),
      workSecret,
      workdir: environment['MECHANE_WORKDIR'] ?? process.cwd(),
    },
  };
}

import { evidenceViewerPath } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { EvidenceExportIdentity, EvidenceExportResult, sandboxEvidenceExportPath } from '@mechane/sandbox-wire';
import { tool } from 'ai';
import { Schema } from 'effect';
import { sleep } from 'workflow';
import { z } from 'zod';
import { loadRuntimeConfiguration } from '../config.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { requestSandboxJson } from './sandbox-transport.ts';
import type { RuntimeToolContext } from './types.ts';

const EXPORT_POLL_ATTEMPTS = 30;
const EXPORT_POLL_INTERVAL_MS = 1000;
const EXPORT_RESPONSE_MAX_BYTES = 16_384;
type ExportInput = RuntimeToolContext & { readonly artifactId: string };
type ExportToolResult = typeof EvidenceExportResult.Encoded & { readonly viewerUrl?: string };

export function exportEvidenceTool(context: RuntimeToolContext) {
  return tool({
    description:
      'Copy one ready saved capture from this mech into its current environment home. Returns its exact path, SHA-256, media type and machine identity for ordinary CLI uploads. It does not take a new screenshot, publish anything, or give access to another mech. Files join the normal home checkpoint; after machine loss call again to restore the durable original.',
    inputSchema: z.strictObject({ artifactId: z.uuid() }),
    execute: (input) => exportSavedEvidence({ ...context, ...input }),
  });
}

async function exportSavedEvidence(input: ExportInput) {
  for (let attempt = 0; attempt < EXPORT_POLL_ATTEMPTS; attempt += 1) {
    const result = await copySavedEvidence(input);

    if (result._tag !== 'Pending') {
      return result;
    }

    if (attempt + 1 < EXPORT_POLL_ATTEMPTS) {
      await sleep(EXPORT_POLL_INTERVAL_MS);
    }
  }

  return { _tag: 'Pending', reason: 'The capture copy is not confirmed yet; calling export_evidence again is safe' };
}

async function copySavedEvidence(input: ExportInput): Promise<ExportToolResult> {
  'use step';

  const isPermitted = await withRuntimeStore(async (store) => {
    const mech = await store.getMech(input);
    const policy = await store.getRuntimePolicy(input);
    const run = await store.getRun({ workspaceId: input.workspaceId, runId: input.runId });

    if (mech.status !== 'active' || policy === null) {
      return false;
    }

    const hasSandbox = !policy.isSuspended && policy.hasSandboxes && policy.machines > 0;
    const isRunActive = run !== null && run.status === 'running' && run.cancelRequestedAt === null;

    return hasSandbox && isRunActive;
  });

  if (!isPermitted) {
    return EvidenceExportResult.cases.Failed.make({ reason: 'Evidence export is not enabled for this active run' });
  }

  const configuration = loadRuntimeConfiguration();
  const identity = Schema.decodeUnknownSync(EvidenceExportIdentity)(input);
  const path = sandboxEvidenceExportPath(identity);
  const url = new URL(path, configuration.sandbox.origin);

  try {
    const response = await requestSandboxJson({
      configuration,
      url,
      method: HttpMethod.Post,
      body: null,
      maximumBytes: EXPORT_RESPONSE_MAX_BYTES,
    });

    const result = Schema.decodeUnknownSync(EvidenceExportResult)(response);
    const encoded = Schema.encodeSync(EvidenceExportResult)(result);

    if (result._tag !== 'Ready') {
      return encoded;
    }

    const viewerPath = evidenceViewerPath(identity);
    const viewerUrl = new URL(viewerPath, configuration.publicOrigin).href;

    return { ...encoded, viewerUrl };
  } catch {
    return EvidenceExportResult.cases.Pending.make({
      reason: 'The capture copy transport was interrupted; copying it again is safe',
    });
  }
}

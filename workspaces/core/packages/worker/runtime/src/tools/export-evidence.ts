import { evidenceViewerPath } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { EvidenceExportIdentity, EvidenceExportResult, sandboxEvidenceExportPath } from '@mechane/sandbox-wire';
import { tool } from 'ai';
import { Schema } from 'effect';
import { z } from 'zod';
import { toolConfiguration, withToolStore } from './context.ts';
import { ToolNotStartedError } from './errors.ts';
import { requestSandboxJson } from './sandbox-transport.ts';
import type { RuntimeToolContext } from './types.ts';

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

async function exportSavedEvidence(input: ExportInput): Promise<ExportToolResult> {
  const configuration = toolConfiguration();
  const identity = Schema.decodeUnknownSync(EvidenceExportIdentity)(input);
  const path = sandboxEvidenceExportPath(identity);
  const url = new URL(path, configuration.sandbox.origin);

  try {
    const response = await withToolStore(async (store) => {
      const mech = await store.getMech(input);
      const policy = await store.getRuntimePolicy(input);
      const run = await store.getRun({ workspaceId: input.workspaceId, runId: input.runId });
      const hasSandboxCapacity = policy !== null && policy.hasSandboxes && policy.machines > 0;
      const hasSandbox = hasSandboxCapacity && !policy.isSuspended;
      const isRunActive = run !== null && run.status === 'running' && run.cancelRequestedAt === null;

      if (mech.status !== 'active' || !hasSandbox || !isRunActive) {
        throw new ToolNotStartedError('Evidence export is not enabled for this active run');
      }

      if (!(await store.canDispatchExecution())) {
        throw new ToolNotStartedError('The originating generation no longer permits new work.');
      }

      return await requestSandboxJson({
        configuration,
        url,
        method: HttpMethod.Post,
        body: null,
        maximumBytes: EXPORT_RESPONSE_MAX_BYTES,
      });
    });

    const result = Schema.decodeUnknownSync(EvidenceExportResult)(response);
    const encoded = Schema.encodeSync(EvidenceExportResult)(result);

    if (result._tag !== 'Ready') {
      return encoded;
    }

    const viewerPath = evidenceViewerPath(identity);
    const viewerUrl = new URL(viewerPath, configuration.publicOrigin).href;

    return { ...encoded, viewerUrl };
  } catch (error) {
    if (error instanceof ToolNotStartedError) {
      return EvidenceExportResult.cases.Failed.make({ reason: error.message });
    }

    return EvidenceExportResult.cases.Pending.make({
      reason: 'The capture copy transport was interrupted; copying it again is safe',
    });
  }
}

import { z } from 'zod';

const EVIDENCE_LABEL_MAX_LENGTH = 256;

const TOOL_EVIDENCE = z.object({
  executionId: z.string().max(EVIDENCE_LABEL_MAX_LENGTH).optional(),
  status: z.string().max(EVIDENCE_LABEL_MAX_LENGTH).optional(),
  reason: z.enum(['notifications_pending', 'execution_stopped']).optional(),
  exitCode: z.number().int().nullable().optional(),
  durationMs: z.number().nonnegative().optional(),
  path: z.string().max(EVIDENCE_LABEL_MAX_LENGTH).optional(),
  version: z.number().int().nonnegative().optional(),
  isTruncated: z.boolean().optional(),
});

export function toolEvidence(output: unknown): unknown {
  const evidence = TOOL_EVIDENCE.safeParse(output);

  if (evidence.success) {
    return { ...evidence.data, isAvailable: true };
  }

  return { isAvailable: true };
}

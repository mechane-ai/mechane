import { z } from 'zod';

export const modelReferenceSchema = z.strictObject({
  workspaceId: z.uuid(),
  mechId: z.uuid(),
  sessionId: z.uuid(),
  runId: z.uuid(),
  modelId: z.string().min(1),
});

export type ModelReference = z.infer<typeof modelReferenceSchema>;

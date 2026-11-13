import { BashExecutionStatus } from '@mechane/protocol';
import { z } from 'zod';

const BashResultFields = z.object({
  executionId: z.string(),
  output: z.string().optional(),
  omittedBytes: z.number().int().nonnegative().optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
  isTruncated: z.boolean().optional(),
  commandOutcome: z
    .discriminatedUnion('state', [
      z.object({ state: z.literal('exited'), exitCode: z.number().int() }),
      z.object({ state: z.literal('timed_out') }),
    ])
    .optional(),
});

export const BashResultSchema = z.discriminatedUnion('status', [
  BashResultFields.extend({ status: z.literal(BashExecutionStatus.Completed), exitCode: z.number().int() }),
  BashResultFields.extend({ status: z.enum(BashExecutionStatus).exclude(['Completed']) }),
]);

export type BashResult = z.infer<typeof BashResultSchema>;

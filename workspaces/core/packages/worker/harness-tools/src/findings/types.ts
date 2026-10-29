import type { FindingReport } from '@mechane/protocol';
import type { FindingReportOutcome } from './schemas.ts';

export type FindingReportInput = { readonly taskId: number; readonly report: FindingReport };

/** The durable reporting port; the task ID makes a replay return its original receipt. */
export type MechFindings = { readonly report: (input: FindingReportInput) => Promise<FindingReportOutcome> };

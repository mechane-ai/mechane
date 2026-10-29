import { defineTool, ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { FindingReport, FindingState } from '@mechane/protocol';
import { Match, Result, Schema } from 'effect';
import { Type } from 'typebox';
import { failedResult } from '../failed-result.ts';
import { textResult } from '../text-result.ts';
import type { OutcomeResults } from '../types.ts';
import type { FindingReportOutcome } from './schemas.ts';
import type { MechFindings } from './types.ts';

/** The model-facing arguments for one scheduled evidence report. */
const FindingParameters = Type.Object({
  watch_id: Type.String({ description: 'The watch ID from the scheduled check.' }),
  key: Type.String({ description: 'A stable identity for this issue across checks.' }),
  state: Type.Enum(FindingState),
  fingerprint: Type.String({
    description: 'A stable signature of the meaningful condition. Keep it unchanged for identical evidence.',
  }),
  summary: Type.String({ description: 'A concise finding and recommendation, or the reason evidence is unknown.' }),
  evidence: Type.Array(Type.String({ description: 'An HTTP or HTTPS link to supporting source evidence.' })),
  window_start: Type.String({ description: 'The evidence window start as an ISO timestamp.' }),
  window_end: Type.String({ description: 'The evidence window end as an ISO timestamp, no later than now.' }),
});

type FindingsInput = { readonly findings: MechFindings };

const FINDING_RESULTS: Readonly<OutcomeResults<FindingReportOutcome>> = {
  Recorded: ({ finding, isChanged }) => {
    const encoded = Schema.encodeSync(FindingReport)(finding);
    const text = JSON.stringify({ finding: encoded, change: finding.change, isChanged });

    return textResult({ text });
  },
  WatchMissing: () => failedResult({ code: 'watch_missing', message: 'The watch does not exist' }),
  CheckMissing: () =>
    failedResult({ code: 'watch_check_missing', message: 'This turn has no scheduled check for that watch' }),
  FindingsFull: () =>
    failedResult({
      code: 'findings_full',
      message: 'The watch has reached its finding identity limit; update an existing identity',
    }),
  InvalidWindow: () =>
    failedResult({
      code: 'finding_window_invalid',
      message: 'The observation window must start before it ends and must not end in the future',
    }),
  EvidenceMissing: () =>
    failedResult({
      code: 'finding_evidence_missing',
      message: 'An open or recovered finding needs a supporting source link; otherwise report unknown',
    }),
};

/** Records scheduled evidence through a root-only, replay-safe tool. */
export function reportFindingTool({ findings }: FindingsInput): ToolRegistration<typeof FindingParameters> {
  const execute: ToolRegistration<typeof FindingParameters>['execute'] = async (args, api) => {
    if (api.conversationId !== ROOT_CONVERSATION_ID) {
      return failedResult({
        code: 'finding_root_required',
        message: 'Only the mech running the scheduled check can report its findings',
      });
    }

    const decoded = Schema.decodeUnknownResult(FindingReport)(args);

    if (Result.isFailure(decoded)) {
      return failedResult({ code: 'finding_arguments_invalid', message: decoded.failure.message });
    }

    const outcome = await findings.report({ taskId: api.taskId, report: decoded.success });

    return Match.valueTags(outcome, FINDING_RESULTS);
  };

  return defineTool({
    name: 'report_finding',
    description:
      'Record fresh evidence for the current scheduled watch. Reuse stable finding keys and fingerprints to suppress duplicates. Record unknown when evidence fails; recovered requires fresh supporting evidence. This tool never authorizes repair, publication, or release.',
    parameters: FindingParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute,
  });
}

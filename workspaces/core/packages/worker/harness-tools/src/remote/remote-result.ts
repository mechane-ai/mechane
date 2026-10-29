import type { RemoteToolsOutcome } from '@mechane/protocol';
import { Match } from 'effect';
import { failedResult } from '../failed-result.ts';
import { textResult } from '../text-result.ts';
import type { OutcomeResults, ToolResult } from '../types.ts';
import { RemoteDiagnostic } from './constants.ts';

type RemoteResultInput = { readonly outcome: RemoteToolsOutcome };

const OUTCOME_RESULTS: Readonly<OutcomeResults<RemoteToolsOutcome>> = {
  Refused: ({ reason }) => failedResult({ code: RemoteDiagnostic.Refused, message: reason }),
  Failed: ({ reason }) => failedResult({ code: RemoteDiagnostic.Failed, message: reason }),
  Returned: ({ isError, content }) => {
    if (isError) {
      return failedResult({ code: RemoteDiagnostic.Failed, message: content });
    }

    return textResult({ text: content });
  },
  Connections: ({ connections }) => {
    const text = JSON.stringify(connections);

    return textResult({ text });
  },
  Tools: ({ tools }) => {
    const text = JSON.stringify(tools);

    return textResult({ text });
  },
};

/** Surfaces cleanup failure alongside the primary outcome instead of reporting a clean success. */
export function remoteResult({ outcome }: RemoteResultInput): ToolResult {
  if (outcome.cleanupFailed === true) {
    const primary = JSON.stringify(outcome);

    return failedResult({
      code: RemoteDiagnostic.Failed,
      message: `Remote transport cleanup failed after this outcome: ${primary}`,
    });
  }

  return Match.valueTags(outcome, OUTCOME_RESULTS);
}

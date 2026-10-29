import { failedResult } from '../failed-result.ts';
import type { OutcomeResults, ThreadChange } from '../types.ts';
import { ThreadDiagnostic } from './constants.ts';
import type { ThreadChangeOutcome } from './schemas.ts';

/** Why a change of a thread or a drone on it is refused, which records nothing. */
type ThreadRefusal = (typeof ThreadChangeOutcome.cases)['ThreadMissing' | 'ThreadResolved']['Type'];

/** What a threads tool answers for a thread it cannot change or start a drone on: one never opened, or resolved. */
export const THREAD_REFUSAL_RESULTS: Readonly<OutcomeResults<ThreadRefusal & Pick<ThreadChange, 'threadId'>>> = {
  ThreadMissing: ({ threadId }) =>
    failedResult({ code: ThreadDiagnostic.Missing, message: `No thread of yours has the id ${threadId}` }),
  ThreadResolved: ({ threadId }) =>
    failedResult({
      code: ThreadDiagnostic.Resolved,
      message: `Thread ${threadId} is resolved, which is final: open a new thread for new work`,
    }),
};

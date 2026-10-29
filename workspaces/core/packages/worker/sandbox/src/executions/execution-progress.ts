import { ExecutionStatus } from '@mechane/sandbox-store';
import type { ExecutionRow } from '@mechane/sandbox-store';
import { ExecutionProgress } from '@mechane/sandbox-wire';

type ExecutionProgressInput = { readonly execution: ExecutionRow };

/** How far a stored execution is, as the sandbox answers it: a pending or dispatched one still runs. */
export function executionProgress({ execution }: ExecutionProgressInput): ExecutionProgress {
  switch (execution.status) {
    case ExecutionStatus.Pending:
    case ExecutionStatus.Dispatched:
      return ExecutionProgress.cases.Running.make({});
    case ExecutionStatus.Exited:
      return ExecutionProgress.cases.Exited.make({
        exitCode: execution.exitCode,
        duration: execution.duration,
        output: { text: execution.outputText, omittedBytes: execution.omittedBytes },
      });
    case ExecutionStatus.TimedOut:
      return ExecutionProgress.cases.TimedOut.make({
        duration: execution.duration,
        output: { text: execution.outputText, omittedBytes: execution.omittedBytes },
      });
    case ExecutionStatus.Uncertain:
      return ExecutionProgress.cases.Uncertain.make({});
    case ExecutionStatus.Unavailable:
      return ExecutionProgress.cases.Unavailable.make({});
    case ExecutionStatus.PersistenceFailed:
      return ExecutionProgress.cases.PersistenceFailed.make({
        reason: execution.reason,
        duration: execution.duration,
        output: { text: execution.outputText, omittedBytes: execution.omittedBytes },
      });
  }
}

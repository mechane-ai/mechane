import { SandboxRunId } from '@mechane/sandbox-wire';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

type InteractiveRunInput = { readonly runId: SandboxRunId };
const CanceledRun = Schema.Struct({ runId: SandboxRunId });

/** Cancellation survives workflow retries so the same run cannot admit another process or browser action. */
export function interactiveRuns({ sql }: RecordsInput) {
  function canceledInteractiveRun({ runId }: InteractiveRunInput): Option.Option<SandboxRunId> {
    const cursor = sql.exec('SELECT run_id AS runId FROM interactive_run_cancellations WHERE run_id = ?', runId);
    const row = decodeFirst({ cursor, schema: CanceledRun });

    return Option.map(row, ({ runId: canceled }) => canceled);
  }

  function cancelInteractiveRun({ runId }: InteractiveRunInput): void {
    sql.exec('INSERT INTO interactive_run_cancellations (run_id) VALUES (?) ON CONFLICT DO NOTHING', runId);
  }

  return { canceledInteractiveRun, cancelInteractiveRun };
}

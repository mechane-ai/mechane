import type { RecordsInput } from '@mechane/store';
import { Option, Result, Schema } from 'effect';
import { capacityRecords } from './capacity/capacity-records.ts';

class InstalledSessionStillAllocated extends Schema.TaggedError<InstalledSessionStillAllocated>()(
  'InstalledSessionStillAllocated',
  {},
) {}

/** The allocation tombstone, owner binding, and schema revision outlive a deleted session. */
export function purgeInstalledSession({ sql }: RecordsInput): void {
  const records = capacityRecords({ sql });
  const binding = records.capacity();

  const isRetirable = Option.exists(
    binding,
    (entry) => entry.owner.isInstalled === true && Option.isNone(entry.reservation),
  );

  if (!isRetirable) {
    const cause = new InstalledSessionStillAllocated({});
    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  sql.exec('DELETE FROM evidence_chunks');
  sql.exec('DELETE FROM evidence_artifacts');
  sql.exec('DELETE FROM browser_calls');
  sql.exec('DELETE FROM browser_tabs');
  sql.exec('DELETE FROM browser_machine');
  sql.exec('DELETE FROM managed_processes');
  sql.exec('DELETE FROM interactive_run_cancellations');
  sql.exec('DELETE FROM execution_cancellations');
  sql.exec('DELETE FROM executions');
  sql.exec('DELETE FROM sandbox_completions');
  sql.exec('DELETE FROM sandbox_stops');
  sql.exec('DELETE FROM machine_drains');
  sql.exec('DELETE FROM machines');
  sql.exec('DELETE FROM file_checkpoint_results');
  sql.exec('DELETE FROM workspace_restores');
  sql.exec('DELETE FROM legacy_checkpoint_receipts');
  sql.exec('DELETE FROM workspace_retirements');
  sql.exec('DELETE FROM portable_maintenance');
  sql.exec(
    'UPDATE sandbox_workspace SET head=NULL, checkpoint=NULL, file_checkpoint=NULL, restoration=NULL, recovery=NULL, activity_sequence=0, last_activity_at_ms=NULL, automatic_at_ms=NULL, checkpoint_error=NULL',
  );
  sql.exec('UPDATE sandbox_activity SET idle_at_ms=NULL, processes_observed_at_ms=NULL');
}

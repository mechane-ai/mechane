import type { ReportInfo } from '@earendil-works/pi-durable';
import { errorCode, writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import type { OpenMechHarnessInput } from './types.ts';

/** A report pi made and the error it carries, the mech its log line names, and the reset of that mech's object. */
type LogReportInput = Pick<OpenMechHarnessInput, 'mechId' | 'abortObject'> & {
  readonly report: ReportInfo;
  readonly error: unknown;
};

/** The reports after which a mech cannot go on: the object resets, and its next event or alarm reopens it. */
const FATAL_REPORTS: ReadonlySet<ReportInfo['type']> = new Set(['session_failed', 'listener_error', 'host_error']);

/**
 * Logs what pi reports for the mech, by the report's type and the error's code, never its text. It resets the object
 * for the reports a mech cannot go on past: a failed session, a commit listener that threw, and a failed host
 * callback.
 */
export function logReport({ error, report, mechId, abortObject }: LogReportInput): void {
  writeLog({ line: { event: LogEvent.HarnessReport, mechId, report: report.type, error: errorCode({ error }) } });

  if (FATAL_REPORTS.has(report.type)) {
    abortObject({ operation: `pi reported ${report.type}`, cause: error });
  }
}

import { Record } from 'effect';
import { TrialVerdict } from '../constants.ts';
import type { Report } from '../store/schemas.ts';

type ReportLinesInput = { readonly report: Report };

/** The report as a person reads it: a line for each trial, then one for the totals. */
export function reportLines({ report }: ReportLinesInput): ReadonlyArray<string> {
  const trialLine: (trial: Report['trials'][number]) => string = (trial) =>
    `${trial.caseId} #${trial.repeat} ${trial.verdict}, its subject charged ${trial.subjectChargedMicros} and its grader ${trial.graderChargedMicros} micro-dollars (trial ${trial.id})`;

  const count: (entry: readonly [keyof typeof TrialVerdict, TrialVerdict]) => string = ([member, verdict]) =>
    `${report.totals[member]} ${verdict}`;

  const counts = Record.toEntries(TrialVerdict).map(count);
  const totalLine = `${report.trials.length} trials by their graders' verdicts: ${counts.join(', ')}; their saved turns charged ${report.subjectChargedMicros} micro-dollars for the subjects and ${report.graderChargedMicros} for the graders`;

  return [`suite ${report.suiteId}, plan ${report.digest}`, ...report.trials.map(trialLine), totalLine];
}

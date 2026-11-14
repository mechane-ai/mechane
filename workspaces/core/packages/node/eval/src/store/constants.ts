/** Private rubrics and observations stay readable and writable by their owner. */
export const RECORD_MODE = 0o600;
export const RECORD_FOLDER_MODE = 0o700;

export const ApplicationFile = {
  Manifest: 'manifest.json',
  Report: 'report.json',
  SubjectIntent: 'subject-intent.json',
  SubjectReceipt: 'subject-receipt.json',
  SubjectNotification: 'subject-notification.json',
  Subject: 'subject.json',
  Evidence: 'evidence.json',
  JudgeIntent: 'judge-intent.json',
  JudgeReceipt: 'judge-receipt.json',
  JudgeNotification: 'judge-notification.json',
  Judge: 'judge.json',
  Submission: 'grade-submission.json',
  Grade: 'grade.json',
  SubjectConnection: 'subject-connection.json',
  JudgeConnection: 'judge-connection.json',
} as const;

export const ApplicationFolder = {
  Trials: 'trials',
  Audits: 'audits',
  Observations: 'observations',
  JudgeObservations: 'judge-observations',
  Cleanup: 'cleanup',
  Failures: 'failures',
} as const;

export const WRITER_FILE = 'writer.sqlite';

export const WRITER_FILES: ReadonlySet<string> = new Set([
  WRITER_FILE,
  `${WRITER_FILE}-journal`,
  `${WRITER_FILE}-wal`,
  `${WRITER_FILE}-shm`,
]);

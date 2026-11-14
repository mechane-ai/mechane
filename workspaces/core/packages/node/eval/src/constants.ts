import { FileStep } from '@mechane/program';

/** How an eval run ended: every trial was graded, whatever the grades, or some trial could not run or be graded. */
export const EvalOutcome = { Completed: 'completed', Incomplete: 'incomplete' } as const;

export type EvalOutcome = (typeof EvalOutcome)[keyof typeof EvalOutcome];

/** The id of a suite, a case or an expectation: lowercase letters, digits, dots, underscores and hyphens. */
export const EVAL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** The version of the suite file's format; a narrowing change increments it. */
export const SUITE_VERSION = 1;

/** The most cases one suite holds. */
export const CASES_PER_SUITE = 100;

/** The most expectations one case holds, each of which the grader judges once. */
export const EXPECTATIONS_PER_CASE = 12;

/** The most trials one case runs, each on fresh mechs. */
export const REPEATS_PER_CASE = 10;

/**
 * The longest input of a case. With its expectations' descriptions, it leaves room in one grader's notification, at
 * most 32,768 characters, for most of a long reply.
 */
export const INPUT_MAX_CHARS = 8192;

/** The longest description of an expectation. */
export const DESCRIPTION_MAX_CHARS = 1024;

export const PUBLICATION_INSTRUCTIONS =
  'Publish your completed answer exactly once using console_message with your answer in text. After publishing, finish quietly. Internal final text is not sent to the requester.';

/** The hexadecimal digits of a trial's id: 128 bits of its SHA-256, as many as a UUID's, so a mech's name holds it. */
export const TRIAL_ID_HEX_CHARS = 32;

export const TRIAL_ID_PATTERN: Readonly<RegExp> = new RegExp(`^[0-9a-f]{${TRIAL_ID_HEX_CHARS}}$`);

/** How the grader judged one expectation. */
export const CriterionVerdict = { Pass: 'pass', Fail: 'fail', Uncertain: 'uncertain' } as const;

export type CriterionVerdict = (typeof CriterionVerdict)[keyof typeof CriterionVerdict];

/**
 * Only a completed grade contributes a criterion verdict. Missing publications and failed or stopped work remain
 * separate outcomes.
 */
export const TrialVerdict = {
  ...CriterionVerdict,
  NoGrade: 'no_grade',
  NoReply: 'no_reply',
  Unavailable: 'unavailable',
  RunFailed: 'run_failed',
  Stopped: 'stopped',
} as const;

export type TrialVerdict = (typeof TrialVerdict)[keyof typeof TrialVerdict];

/** The steps on the out folder's files that can fail: each of a file's own steps, a read, a decode and a new folder. */
export const EvalFileStep = { ...FileStep, Read: 'read', Decode: 'decode', CreateFolder: 'create the folder' } as const;

export type EvalFileStep = (typeof EvalFileStep)[keyof typeof EvalFileStep];

/** A fresh agent either proposes application changes or judges frozen evidence. */
export const EvalRole = { Subject: 'subject', Judge: 'judge' } as const;
export type EvalRole = (typeof EvalRole)[keyof typeof EvalRole];

/** The selected infrastructure runs the same notification and tool protocol. */
export const EvalTargetKind = { Local: 'local', Hosted: 'hosted' } as const;
export type EvalTargetKind = (typeof EvalTargetKind)[keyof typeof EvalTargetKind];

/** Audits grade saved evidence or fixed calibration examples without running subjects. */
export const EvalAuditKind = { Regrade: 'regrade', Calibrate: 'calibrate' } as const;
export type EvalAuditKind = (typeof EvalAuditKind)[keyof typeof EvalAuditKind];

/** Judge-only records do not claim that the audit executed its source subjects. */
export const EvalScope = { Full: 'full', JudgeOnly: 'judge_only' } as const;
export type EvalScope = (typeof EvalScope)[keyof typeof EvalScope];

/** Recorded observations come from authenticated MCP tool requests. */
export const ObservationProvenance = { Mcp: 'mcp' } as const;
export type ObservationProvenance = (typeof ObservationProvenance)[keyof typeof ObservationProvenance];

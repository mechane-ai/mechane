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

/**
 * The version of the plan file's format and of its trials' records, which the digest covers; a narrowing of either
 * increments it, so a rerun refuses an older out folder.
 */
export const PLAN_VERSION = 2;

/** The version of the report's format, in its file and on standard output; a narrowing change increments it. */
export const REPORT_VERSION = 3;

/** The hexadecimal digits of a trial's id: 128 bits of its SHA-256, as many as a UUID's, so a mech's name holds it. */
export const TRIAL_ID_HEX_CHARS = 32;

/** A trial's id as its files and records write it. */
export const TRIAL_ID_PATTERN: Readonly<RegExp> = new RegExp(`^[0-9a-f]{${TRIAL_ID_HEX_CHARS}}$`);

/** How the grader judged one expectation. */
export const CriterionVerdict = { Pass: 'pass', Fail: 'fail', Uncertain: 'uncertain' } as const;

export type CriterionVerdict = (typeof CriterionVerdict)[keyof typeof CriterionVerdict];

export const RoleStatus = {
  Published: 'published',
  NoReply: 'no_reply',
  Failed: 'failed',
  Stopped: 'stopped',
} as const;

export const GraderStatus = {
  Graded: 'graded',
  NoGrade: 'no_grade',
  NoReply: RoleStatus.NoReply,
  Failed: RoleStatus.Failed,
  Stopped: RoleStatus.Stopped,
} as const;

/**
 * Only a completed grade contributes a criterion verdict. Missing publications and failed or stopped work remain
 * separate outcomes.
 */
export const TrialVerdict = {
  ...CriterionVerdict,
  NoGrade: GraderStatus.NoGrade,
  NoReply: RoleStatus.NoReply,
  Unavailable: 'unavailable',
  RunFailed: 'run_failed',
  Stopped: RoleStatus.Stopped,
} as const;

export type TrialVerdict = (typeof TrialVerdict)[keyof typeof TrialVerdict];

/** The steps on the out folder's files that can fail: each of a file's own steps, a read, a decode and a new folder. */
export const EvalFileStep = { ...FileStep, Read: 'read', Decode: 'decode', CreateFolder: 'create the folder' } as const;

export type EvalFileStep = (typeof EvalFileStep)[keyof typeof EvalFileStep];

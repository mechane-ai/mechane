import { REPLY_PREFIX } from '@mechane/stack';

/** The scenario's two cases: one its grader grades, and one whose grader answers with text. */
export const EvalCase = { Graded: 'graded', Ungraded: 'ungraded' } as const;

/** The expectation each case holds, which the grader judges under its id. */
const EXPECTATION = { id: 'names-a-color', description: 'The reply names a primary color.' } as const;

/** Whether the scenario's suite grades itself, which it declares, since both roles run on the one offer it names. */
const IS_SELF_GRADING = true;

/** The grade the graded case's grader answers with, which passes its one expectation. */
const GRADE = {
  summary: 'The reply names a color.',
  criteria: [{ id: EXPECTATION.id, verdict: 'pass', evidence: 'it names one' }],
} as const;

/**
 * The scenario's suite: each case runs once on the scripted upstream's first offer, which echoes the subject's input,
 * for both roles. The graded case's expectation ends with a reply line holding its grade, which only its grader
 * receives and answers with. The ungraded case's grader echoes its inbox item, which is no grade.
 */
export const SUITE = {
  version: 1,
  id: 'smoke',
  subject: {},
  grader: {},
  self_grading: IS_SELF_GRADING,
  repeats: 1,
  trial_cap_micros: 1_000_000,
  cases: [
    {
      id: EvalCase.Graded,
      input: 'Name a primary color.',
      expectations: [
        { ...EXPECTATION, description: `${EXPECTATION.description}\n${REPLY_PREFIX}${JSON.stringify(GRADE)}` },
      ],
    },
    { id: EvalCase.Ungraded, input: 'Name a primary color.', expectations: [EXPECTATION] },
  ],
} as const;

/** The suite's file and the run's out folder in the scenario's folder. */
export const EvalPath = { Suite: 'suite.json', Out: 'out' } as const;

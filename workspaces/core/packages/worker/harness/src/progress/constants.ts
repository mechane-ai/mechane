/** pi's submission states this harness compares by member. */
export const PiSubmissionStatus = {
  Queued: 'queued',
  Placed: 'placed',
  Done: 'done',
  Unanswered: 'unanswered',
} as const;

/** pi's submission kinds: a silent inbox item is a write, and every other one an input. */
export const PiSubmissionType = { Input: 'input', Write: 'write' } as const;

/** The kinds of committed change this harness reads by member. */
export const PiChangeType = { Submission: 'submission', Entry: 'entry' } as const;

/** The message role and content type of an answer's text. */
export const PiAnswerPart = { Role: 'assistant', Text: 'text' } as const;

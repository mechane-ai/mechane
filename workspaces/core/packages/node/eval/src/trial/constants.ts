/** The two mechs of a trial, each created fresh for it: the subject that answers, and the grader that judges. */
export const Role = { Subject: 'subject', Grader: 'grader' } as const;

export type Role = (typeof Role)[keyof typeof Role];

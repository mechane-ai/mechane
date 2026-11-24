/**
 * The words an article writes around the author's content. The present view's position reads "Beat 2 of 5, step 1":
 * `beat`, the number, `of`, the count, then `step` and its number.
 */
export type ArticleLabels = {
  readonly contents: string;
  readonly figure: string;
  readonly notes: string;
  readonly note: string;
  readonly references: string;
  readonly backToText: string;
  readonly by: string;
  readonly previous: string;
  readonly next: string;
  readonly beat: string;
  readonly of: string;
  readonly step: string;
  readonly figureDescription: string;
  readonly showAnswer: string;
  readonly sheet: string;
  readonly checks: string;
  readonly noProblems: string;
  readonly opening: string;
  readonly goal: string;
  readonly misconception: string;
  readonly tutorHints: string;
  readonly steps: string;
  readonly progress: string;
};

export const defaultArticleLabels = {
  contents: 'Contents',
  figure: 'Figure',
  notes: 'Notes',
  note: 'Note',
  references: 'References',
  backToText: 'Back to the text',
  by: 'By',
  previous: 'Previous',
  next: 'Next',
  beat: 'Beat',
  of: 'of',
  step: 'step',
  figureDescription: 'What the figure shows',
  showAnswer: 'Show the answer',
  sheet: 'Beat sheet',
  checks: 'Checks',
  noProblems: 'No problems found.',
  opening: 'Opening',
  goal: 'Goal',
  misconception: 'Misconception',
  tutorHints: 'Tutor hints',
  steps: 'Reveal steps',
  progress: 'Reading progress',
} as const satisfies ArticleLabels;

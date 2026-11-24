/**
 * Narrative structure for explorable essays. An `Article` renders a lesson as beats of prose, figures and exercises,
 * and arranges the same children as a scrolling essay, a presentation, a static page or a beat sheet.
 */
export type { ArticleProps } from './article.tsx';
export { Article } from './article.tsx';
export type { ArticleMath, ArticleView } from './article-context.ts';
export type { ArticleLabels } from './article-labels.ts';
export { defaultArticleLabels } from './article-labels.ts';
export type { ArticleFinding } from './article-checks.ts';
export { articleChecks } from './article-checks.ts';
export { answerSources, articleOutline } from './article-outline.ts';
export type { BeatProps } from './beat.tsx';
export { Beat } from './beat.tsx';
export type { FigureProps, FigureReferenceProps, FigureSize, RevealProps } from './figure.tsx';
export { Figure, FigureReference, Reveal, useRevealed } from './figure.tsx';
export type { AsideProps, CiteProps, FootnoteProps, ReferencesProps } from './notes.tsx';
export type { ArticleOutline, OutlineBeat, OutlineFigure, OutlinePrediction, ReferenceItem } from './outline-types.ts';
export { Aside, Cite, Footnote, References } from './notes.tsx';
export type { TeXProps } from './tex.tsx';
export { TeX } from './tex.tsx';
export type { DiagramPartProps, TermLabels, TermProps } from './term.tsx';
export { DiagramPart, Term } from './term.tsx';
export type { ScrollyProps, ScrollyStepProps } from './scrolly.tsx';
export { Scrolly, ScrollyStep } from './scrolly.tsx';
export type { ChoicePrediction, NumberPrediction, PredictLabels, PredictProps } from './predict.tsx';
export { Predict } from './predict.tsx';
export type { ChallengeLabels, ChallengeProps } from './challenge.tsx';
export { Challenge } from './challenge.tsx';
export type {
  LessonProgress,
  PredictionRecord,
  ProgressChangeDetails,
  ProgressChangeReason,
} from './progress-store.ts';
export { emptyProgress } from './progress-store.ts';

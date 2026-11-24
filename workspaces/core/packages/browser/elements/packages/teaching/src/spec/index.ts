/**
 * Lessons as plain data, for authors and their agents. Check a plan before writing components, read a defined lesson as
 * an outline or as text, get teaching advice, and choose parts from the guide. Runs in Node and in the browser.
 */
export { checkLesson } from './advice.ts';
export type {
  LessonOutline,
  OutlineBeat,
  OutlineDerived,
  OutlineFormat,
  OutlineParam,
  OutlineState,
} from './describe-lesson.ts';
export { describeLesson, lessonWalk, writtenValue } from './describe-lesson.ts';
export type { ExplainerGuideEntry, ExplainerPart } from './explainer-guide.ts';
export { explainerGuide, explainerParts } from './explainer-guide.ts';
export type { LessonFinding } from './findings.ts';
export { valueProblem } from './findings.ts';
export type { LessonPlan, LessonPlanAsk, LessonPlanBeat, LessonPlanDerived, LessonPlanFigure } from './lesson-plan.ts';
export type { LessonPlanResult } from './validate-plan.ts';
export { validateLessonPlan } from './validate-plan.ts';

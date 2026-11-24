/**
 * Agents beside a reader. Tutor tools read and move a lesson through the UI SDK agent bridge. A learner trace records
 * what the reader did, and a tour plays a guided walk that pauses when the reader acts.
 */
export type { LearnerEvent, LearnerEventKind, LearnerRecord, LearnerTrace } from './learner-trace.ts';
export { LEARNER_TRACE_LIMIT, createLearnerTrace, summarizeTrace } from './learner-trace.ts';
export type { AnswerSources, LessonAgent, TutorChange } from './lesson-bridge.ts';
export type { LessonTour, LessonTourStep, TourHold, TourPlayer, TourStatus } from './lesson-tour.ts';
export { playTour, tourFromTrace, tourHolds, validateTour } from './lesson-tour.ts';
export type {
  ReaderPlace,
  TutorNotes,
  TutorResult,
  TutorSchema,
  TutorSchemaProperty,
  TutorTool,
} from './tutor-tools.ts';
export { tutorTools } from './tutor-tools.ts';

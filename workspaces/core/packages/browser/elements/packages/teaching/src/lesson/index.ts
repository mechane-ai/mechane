export { isMotionReduced, onFrame } from '../time/clock.ts';
export type { Pace, Tween } from '../time/tween.ts';
export { createTween } from '../time/tween.ts';
export { useTween } from '../time/use-tween.ts';
export { LessonLocale, useLessonLocale } from './lesson-locale.ts';
export type {
  AnyLesson,
  ChoiceParam,
  LessonBeat,
  LessonDefinition,
  LessonDerived,
  LessonDerivedInput,
  LessonGraph,
  LessonInput,
  LessonParam,
  LessonParams,
  LessonState,
  LessonValue,
  LessonValues,
  NumberParam,
  ParamValues,
  ToggleParam,
  ToggleValue,
} from './define-lesson.ts';
export { defineLesson, lessonGraph } from './define-lesson.ts';
export type {
  LessonApi,
  LessonChangeOrigin,
  LessonPlaceChangeDetails,
  LessonPlaceChangeReason,
  LessonPlaceOrigin,
  LessonPlayingChangeDetails,
  LessonValuesChangeDetails,
  LessonValuesChangeReason,
} from './lesson-store.ts';
export type { LessonPlayer, LessonPlayingChangeReason, PlayOrigin, PlaybackPace } from './lesson-player.ts';
export { playbackPaces } from './lesson-player.ts';
export type { LessonProps } from './lesson.tsx';
export { Lesson } from './lesson.tsx';
export type { LessonControls } from './use-lesson.ts';
export { useLesson, useLessonContext } from './use-lesson.ts';
export type { BoundValueChangeDetails, BoundValueProps, BoundValueScale } from './bound-value.tsx';
export { BoundValue } from './bound-value.tsx';
export type { ParamProps, ValueLabels, ValueProps } from './param.tsx';
export { Param, Value } from './param.tsx';
export type { ParamControlProps } from './param-controls.tsx';
export { ParamChoice, ParamSlider, ParamToggle } from './param-controls.tsx';
export type { PlaybackControls, PlaybackProps } from './playback.tsx';
export { Playback, usePlayback } from './playback.tsx';
export type { TransportLabels, TransportProps } from './transport.tsx';
export { Transport } from './transport.tsx';

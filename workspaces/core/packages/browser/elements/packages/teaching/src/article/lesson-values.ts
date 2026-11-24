import { paramProblem } from '../lesson/define-lesson.ts';
import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';

/** The first problem with values an author wrote for a lesson, such as a name it lacks or a number out of range. */
export function valuesProblem(lesson: AnyLesson, values: Readonly<Record<string, LessonValue>>): string | undefined {
  const params = new Map(Object.entries(lesson.params));

  return Object.entries(values)
    .flatMap(([name, value]) => {
      const param = params.get(name);

      if (param === undefined) {
        return [`Lesson "${lesson.id}" has no param "${name}".`];
      }

      return paramProblem({ name, param, value }) ?? [];
    })
    .at(0);
}

/** The values a beat state declares, by the state's id in any beat, or undefined when no beat declares it. */
export function stateValues(lesson: AnyLesson, state: string): Readonly<Record<string, LessonValue>> | undefined {
  return lesson.beats.flatMap((beat) => beat.states ?? []).find((item) => item.id === state)?.values;
}

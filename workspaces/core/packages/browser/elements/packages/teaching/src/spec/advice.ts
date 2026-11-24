import type { AnyLesson } from '../lesson/define-lesson.ts';
import { adviceAt } from './findings.ts';
import type { LessonFinding } from './findings.ts';

/** A beat as the teaching advice reads it, from a plan or from a defined lesson. */
export type AdviceBeat = {
  readonly id: string;
  readonly title: string;
  readonly hasGoal: boolean;
  /** The values each declared state sets. */
  readonly states: ReadonlyArray<Readonly<Record<string, unknown>>>;
};

/** A lesson as the teaching advice reads it. */
export type AdviceOutline = {
  /** The opening value of every param. */
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly beats: ReadonlyArray<AdviceBeat>;
};

/** How many beats in a row may pass before the reader deserves a recap. */
const RECAP_EVERY = 7;
const RECAP_TITLE = /\b(recap|summary|review|so far|together)\b/iu;

/** The params a beat's states move away from their opening values. */
function movedBy(beat: AdviceBeat, defaults: Readonly<Record<string, unknown>>): ReadonlySet<string> {
  return new Set(
    beat.states.flatMap((values) =>
      Object.entries(values).flatMap(([name, value]) =>
        Object.hasOwn(defaults, name) && defaults[name] !== value ? [name] : [],
      ),
    ),
  );
}

function goalAdvice(beats: ReadonlyArray<AdviceBeat>): ReadonlyArray<LessonFinding> {
  return beats.flatMap((beat, index) =>
    beat.hasGoal
      ? []
      : [
          adviceAt(
            `beats[${index}].goal`,
            `Beat "${beat.id}" has no goal. Add one sentence the reader should be able to say after it.`,
          ),
        ],
  );
}

function introductionAdvice({ defaults, beats }: AdviceOutline): ReadonlyArray<LessonFinding> {
  const moved = beats.map((beat) => movedBy(beat, defaults));

  return beats.flatMap((beat, index) => {
    const earlier = new Set(moved.slice(0, index).flatMap((names) => [...names]));
    const introduced = [...(moved[index] ?? [])].filter((name) => !earlier.has(name));

    return introduced.length > 1
      ? [
          adviceAt(
            `beats[${index}].states`,
            `Beat "${beat.id}" introduces ${introduced.length} new params (${introduced.join(', ')}). Introduce one per beat, so the reader can tell what each one does.`,
          ),
        ]
      : [];
  });
}

function stillParamAdvice({ defaults, beats }: AdviceOutline): ReadonlyArray<LessonFinding> {
  const moved = new Set(beats.flatMap((beat) => [...movedBy(beat, defaults)]));

  return Object.keys(defaults)
    .filter((name) => !moved.has(name))
    .map((name) =>
      adviceAt(
        `params.${name}`,
        `No beat state changes "${name}". Add a state that moves it, so a beat sheet and a tutor can show what it does.`,
      ),
    );
}

function recapAdvice(beats: ReadonlyArray<AdviceBeat>): ReadonlyArray<LessonFinding> {
  const recaps = [-1, ...beats.flatMap((beat, index) => (RECAP_TITLE.test(beat.title) ? [index] : [])), beats.length];

  return recaps.slice(1).flatMap((end, index) => {
    const start = (recaps[index] ?? -1) + 1;

    return end - start > RECAP_EVERY
      ? [
          adviceAt(
            `beats[${start}]`,
            `Beats ${start + 1} to ${end} run ${end - start} beats with no recap. Add a beat titled "Recap" that restates the idea so far.`,
          ),
        ]
      : [];
  });
}

/** The teaching advice every lesson gets, from a plan or from a definition. */
export function outlineAdvice(outline: AdviceOutline): ReadonlyArray<LessonFinding> {
  return [
    ...goalAdvice(outline.beats),
    ...introductionAdvice(outline),
    ...stillParamAdvice(outline),
    ...recapAdvice(outline.beats),
  ];
}

/**
 * Teaching advice for a lesson made by `defineLesson`: beats with no goal, beats that introduce several params at once,
 * params no state moves and long runs without a recap. The definition itself was checked when it was made.
 */
export function checkLesson(lesson: AnyLesson): ReadonlyArray<LessonFinding> {
  return outlineAdvice({
    defaults: lesson.defaults,
    beats: lesson.beats.map((beat) => ({
      id: beat.id,
      title: beat.title,
      hasGoal: (beat.goal ?? '').trim().length > 0,
      states: (beat.states ?? []).map((state) => state.values),
    })),
  });
}

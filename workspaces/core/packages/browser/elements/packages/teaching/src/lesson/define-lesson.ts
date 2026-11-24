import type { ValueFormat } from '../../../charts/src/index.ts';
import { failLesson } from './lesson-error.tsx';

/** A number the reader changes, with its range, its step grid and how it is written. */
export type NumberParam = {
  readonly kind: 'number';
  readonly label: string;
  /** The value the lesson opens with. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** The grid values land on. A player advances by one step at a time. */
  readonly step: number;
  /** `log` gives each tenfold the same drag distance, for rates and other ratios. */
  readonly scale?: 'linear' | 'log' | undefined;
  readonly format: ValueFormat;
};

/** One of a few named options, such as which card is dealt. */
export type ChoiceParam = {
  readonly kind: 'choice';
  readonly label: string;
  /** The id of the option the lesson opens with. */
  readonly value: string;
  readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>;
};

/** A yes or no setting, such as whether an answer is revealed. */
export type ToggleParam = { readonly kind: 'toggle'; readonly label: string; readonly value: ToggleValue };

/** Whether a toggle is on. */
export type ToggleValue = boolean;

/** A value the reader, the application or an agent may set. */
export type LessonParam = NumberParam | ChoiceParam | ToggleParam;

/** What a param or derived value holds. */
export type LessonValue = number | string | boolean;

/** The params of a lesson, by name. */
export type LessonParams = Readonly<Record<string, LessonParam>>;

/** A named state of the lesson: the values a beat shows at one moment. Plain data. */
export type LessonState = {
  readonly id: string;
  readonly label: string;
  readonly values: Readonly<Record<string, LessonValue>>;
};

/** One beat of the essay as data, so an agent can read the outline without rendering it. */
export type LessonBeat = {
  readonly id: string;
  readonly title: string;
  /** Tutor notes. Never shown to the reader. */
  readonly goal?: string | undefined;
  readonly misconception?: string | undefined;
  readonly hints?: ReadonlyArray<string> | undefined;
  /** How many reveal steps the beat has after its first view. Defaults to 0. */
  readonly steps?: number | undefined;
  /** The states worth seeing on a beat sheet and in the static view. The first is the beat's opening state. */
  readonly states?: ReadonlyArray<LessonState> | undefined;
  /** The params this beat owns, which `resetBeat` returns to their opening values. Defaults to those its states set. */
  readonly params?: ReadonlyArray<string> | undefined;
};

/** A derived value as a lesson keeps it: its label and format. */
export type LessonDerived = { readonly label: string; readonly format: ValueFormat };

type ParamValue<Param> = Param extends NumberParam
  ? number
  : Param extends ChoiceParam
    ? Param['options'][number]['id']
    : Param extends ToggleParam
      ? boolean
      : never;

/** The value of each param, typed by its kind: a number, an option id or a boolean. */
export type ParamValues<Params extends LessonParams> = { readonly [Name in keyof Params]: ParamValue<Params[Name]> };

/** Every value a lesson's readers see: its params and its derived numbers. */
export type LessonValues<Params extends LessonParams, Derived extends string> = string extends Derived
  ? Readonly<Record<string, LessonValue>>
  : ParamValues<Params> & Readonly<Record<Derived, number>>;

/** How an author declares a derived value: `from` is a pure function of the params and earlier derived values. */
export type LessonDerivedInput<Values> = LessonDerived & { readonly from: (values: Values) => number };

/** A lesson made by `defineLesson`: the params, derived values and beats every part of the lesson reads. */
export type LessonDefinition<
  Params extends LessonParams = LessonParams,
  Derived extends string = string,
  Beat extends string = string,
> = {
  readonly id: string;
  readonly title: string;
  readonly params: Params;
  readonly derived: Readonly<Record<Derived, LessonDerived>>;
  readonly beats: ReadonlyArray<LessonBeat & { readonly id: Beat }>;
  /** The opening value of every param. */
  readonly defaults: ParamValues<Params>;
  /** Every value, params and derived, at the opening values. */
  readonly initial: LessonValues<Params, Derived>;
  /** Every derived value from a full set of param values, in declaration order. */
  readonly compute: (values: Readonly<Record<string, LessonValue>>) => Readonly<Record<string, number>>;
  /** The names each derived value reads, from evaluating it over the defaults and every beat state. */
  readonly reads: Readonly<Record<string, ReadonlyArray<string>>>;
};

/** What an author writes to declare a lesson. */
export type LessonInput<Params extends LessonParams, Derived extends string, Beat extends string> = {
  readonly id: string;
  readonly title: string;
  readonly params: Params;
  /** Values computed from params and from derived values declared earlier. `from` must be pure. */
  readonly derived?: Readonly<Record<Derived, LessonDerivedInput<LessonValues<Params, Derived>>>> | undefined;
  readonly beats?: ReadonlyArray<LessonBeat & { readonly id: Beat }> | undefined;
};

/** Any lesson, whatever its params. Untyped parts take this. */
export type AnyLesson = LessonDefinition;

/** The graph of a lesson: its values and which values each derived value reads. */
export type LessonGraph = {
  readonly nodes: ReadonlyArray<{ readonly name: string; readonly kind: 'param' | 'derived'; readonly label: string }>;
  readonly edges: ReadonlyArray<{ readonly from: string; readonly to: string }>;
};

/** Why `value` cannot be the value of `param`, or undefined when it can. */
export function paramProblem({
  name,
  param,
  value,
}: {
  readonly name: string;
  readonly param: LessonParam;
  readonly value: unknown;
}): string | undefined {
  switch (param.kind) {
    case 'number': {
      const isInRange = typeof value === 'number' && Number.isFinite(value) && value >= param.min;

      return isInRange && value <= param.max
        ? undefined
        : `${name} takes a number from ${param.min} to ${param.max}, not ${String(value)}.`;
    }
    case 'choice':
      return param.options.some((option) => option.id === value)
        ? undefined
        : `${name} takes one of ${param.options.map((option) => option.id).join(', ')}, not ${String(value)}.`;
    case 'toggle':
      return typeof value === 'boolean' ? undefined : `${name} takes true or false, not ${String(value)}.`;
  }
}

function numberParamProblem(name: string, param: NumberParam): string | undefined {
  const hasBounds = Number.isFinite(param.min) && Number.isFinite(param.max) && param.min < param.max;

  if (!hasBounds) {
    return `${name} needs finite bounds with min below max.`;
  }

  if (!(param.step > 0)) {
    return `${name} needs a step above zero.`;
  }

  return param.scale === 'log' && param.min <= 0
    ? `${name} is on a log scale, so its min must be above zero.`
    : undefined;
}

function declarationProblem(name: string, param: LessonParam): string | undefined {
  if (param.kind === 'number') {
    const problem = numberParamProblem(name, param);

    if (problem !== undefined) {
      return problem;
    }
  }

  if (param.kind === 'choice') {
    const ids = param.options.map((option) => option.id);

    if (new Set(ids).size !== ids.length || ids.length === 0) {
      return `${name} needs at least one option, each with its own id.`;
    }
  }

  const problem = paramProblem({ name, param, value: param.value });

  return problem === undefined ? undefined : `the default of ${problem}`;
}

function duplicate(ids: ReadonlyArray<string>): string | undefined {
  return ids.find((id, index) => ids.indexOf(id) !== index);
}

/** Reads values through a record that remembers each name read, so running a derived value finds its inputs. */
function tracked<Values extends object>(
  values: Values,
): { readonly view: Values; readonly names: ReadonlySet<string> } {
  const names = new Set<string>();

  const view = new Proxy(values, {
    get(target, key, receiver) {
      if (typeof key === 'string') {
        names.add(key);
      }

      return Reflect.get(target, key, receiver);
    },
  });

  return { view, names };
}

function stateProblems(beat: LessonBeat, params: LessonParams): ReadonlyArray<string> {
  const known = new Map(Object.entries(params));

  return (beat.states ?? []).flatMap((state) =>
    Object.entries(state.values).flatMap(([name, value]) => {
      const param = known.get(name);
      const where = `state "${state.id}" of beat "${beat.id}"`;

      if (param === undefined) {
        return [`${where} sets "${name}", which is not a param.`];
      }

      const problem = paramProblem({ name, param, value });

      return problem === undefined ? [] : [`${where}: ${problem}`];
    }),
  );
}

function beatProblems(beat: LessonBeat, params: LessonParams): ReadonlyArray<string> {
  const steps = beat.steps ?? 0;
  const isWhole = Number.isInteger(steps) && steps >= 0;
  const repeatedState = duplicate((beat.states ?? []).map((state) => state.id));
  const unknownParam = (beat.params ?? []).find((name) => !Object.hasOwn(params, name));

  return [
    ...(isWhole ? [] : [`beat "${beat.id}" needs a whole number of steps, not ${steps}.`]),
    ...(repeatedState === undefined ? [] : [`beat "${beat.id}" has two states with the id "${repeatedState}".`]),
    ...(unknownParam === undefined ? [] : [`beat "${beat.id}" owns "${unknownParam}", which is not a param.`]),
    ...stateProblems(beat, params),
  ];
}

/** The params a beat owns: the ones it declares, or else every param its states set. */
export function beatParams(beat: LessonBeat): ReadonlyArray<string> {
  return beat.params ?? [...new Set((beat.states ?? []).flatMap((state) => Object.keys(state.values)))];
}

function lessonProblems({
  params,
  derivedNames,
  beats,
}: {
  readonly params: LessonParams;
  readonly derivedNames: ReadonlyArray<string>;
  readonly beats: ReadonlyArray<LessonBeat>;
}): ReadonlyArray<string> {
  const paramNames = new Set(Object.keys(params));
  const both = derivedNames.find((name) => paramNames.has(name));
  const repeatedBeat = duplicate(beats.map((beat) => beat.id));

  return [
    ...Object.entries(params).flatMap(([name, param]) => declarationProblem(name, param) ?? []),
    ...(both === undefined ? [] : [`"${both}" is declared as both a param and a derived value.`]),
    ...(repeatedBeat === undefined ? [] : [`two beats share the id "${repeatedBeat}".`]),
    ...beats.flatMap((beat) => beatProblems(beat, params)),
  ];
}

/**
 * Declares a lesson: its params with their ranges, steps and formats, the values derived from them, and its beats as
 * plain data. Every prose value, control, figure, player and agent of the lesson reads these names. A duplicate or
 * unknown name, a default out of range or a beat state naming an undeclared param throws an `Error` naming it.
 */
export function defineLesson<
  const Params extends LessonParams,
  const Derived extends string = never,
  const Beat extends string = string,
>(definition: LessonInput<Params, Derived, Beat>): LessonDefinition<Params, Derived, Beat>;
export function defineLesson(definition: LessonInput<LessonParams, string, string>): AnyLesson {
  const { id, title, params } = definition;
  const derivedInputs = Object.entries(definition.derived ?? {});
  const beats = definition.beats ?? [];
  const paramNames = Object.keys(params);
  const derivedNames = derivedInputs.map(([name]) => name);

  const [problem] = lessonProblems({ params, derivedNames, beats });

  if (problem !== undefined) {
    failLesson(id, problem);
  }

  const defaults = Object.fromEntries(Object.entries(params).map(([name, param]) => [name, param.value]));

  const placeholders: Readonly<Record<string, number>> = Object.fromEntries(
    derivedNames.map((name) => [name, Number.NaN]),
  );

  function evaluate(values: Readonly<Record<string, LessonValue>>): {
    readonly results: Readonly<Record<string, number>>;
    readonly reads: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
  } {
    const state = { known: { ...values, ...placeholders }, results: placeholders };
    const allowed = new Set(paramNames);

    const reads = derivedInputs.map(([name, input]) => {
      const { view, names } = tracked(state.known);
      const value = input.from(view);
      const unknown = [...names].find((read) => !allowed.has(read));

      if (unknown !== undefined) {
        failLesson(
          id,
          `derived "${name}" reads "${unknown}", which is not a param or a derived value declared before it.`,
        );
      }

      if (typeof value !== 'number') {
        failLesson(id, `derived "${name}" must return a number.`);
      }

      allowed.add(name);

      state.known = { ...state.known, [name]: value };
      state.results = { ...state.results, [name]: value };

      return [name, [...names]] as const;
    });

    return { results: state.results, reads };
  }

  const opening = evaluate(defaults);

  const stateReads = beats.flatMap((beat) =>
    (beat.states ?? []).map((lessonState) => evaluate({ ...defaults, ...lessonState.values }).reads),
  );

  const reads = Object.fromEntries(
    derivedNames.map((name) => [
      name,
      [
        ...new Set(
          [opening.reads, ...stateReads].flatMap((evaluation) =>
            evaluation.filter(([reader]) => reader === name).flatMap(([, names]) => names),
          ),
        ),
      ],
    ]),
  );

  return {
    id,
    title,
    params,
    derived: Object.fromEntries(
      derivedInputs.map(([name, input]) => [name, { label: input.label, format: input.format }]),
    ),
    beats,
    defaults,
    initial: { ...defaults, ...opening.results },
    compute: (values) => evaluate(values).results,
    reads,
  };
}

/**
 * Which values each derived value reads, found by evaluating it over the defaults and every beat state. Draw it as a
 * derivation diagram, or check that a lesson's figures read the values its prose sets.
 */
export function lessonGraph(lesson: AnyLesson): LessonGraph {
  return {
    nodes: [
      ...Object.entries(lesson.params).map(([name, param]) => ({ name, kind: 'param' as const, label: param.label })),
      ...Object.entries(lesson.derived).map(([name, derived]) => ({
        name,
        kind: 'derived' as const,
        label: derived.label,
      })),
    ],
    edges: Object.entries(lesson.reads).flatMap(([to, names]) => names.map((from) => ({ from, to }))),
  };
}

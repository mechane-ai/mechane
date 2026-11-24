import type { AnyLesson, LessonParam } from '../lesson/define-lesson.ts';

/** One thing a check found: where it is, a sentence that says what to do, and whether it stops the lesson. */
export type LessonFinding = {
  /** Where the finding is, written like `beats[2].states[0].values.temperature`. */
  readonly path: string;
  readonly message: string;
  /** `error` means `defineLesson` would refuse it; `advice` is teaching practice the author may decline. */
  readonly severity: 'error' | 'advice';
};

/** What a value must be to suit a param: a number in a range, one option id, or true or false. */
export type ValueRule =
  | { readonly kind: 'number'; readonly min: number; readonly max: number }
  | { readonly kind: 'choice'; readonly ids: ReadonlyArray<string> }
  | { readonly kind: 'toggle' };

/** An error finding. */
export function errorAt(path: string, message: string): LessonFinding {
  return { path, message, severity: 'error' };
}

/** An advice finding. */
export function adviceAt(path: string, message: string): LessonFinding {
  return { path, message, severity: 'advice' };
}

/** The fields of a plain object, or undefined for anything else. */
export function fieldsOf(value: unknown): ReadonlyMap<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return new Map<string, unknown>(Object.entries(value));
}

/** A value's JSON kind with its article, for messages: "a string", "an array", "nothing". */
export function kindText(value: unknown): string {
  if (value === undefined) {
    return 'nothing';
  }

  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'an array';
  }

  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/** The rule a declared param sets for its values. */
function ruleOf(param: LessonParam): ValueRule {
  switch (param.kind) {
    case 'number':
      return { kind: 'number', min: param.min, max: param.max };
    case 'choice':
      return { kind: 'choice', ids: param.options.map((option) => option.id) };
    case 'toggle':
      return { kind: 'toggle' };
  }
}

/** Why `value` does not suit a param with this rule, or undefined when it does. */
export function ruleProblem(name: string, rule: ValueRule, value: unknown): string | undefined {
  switch (rule.kind) {
    case 'number': {
      const isNumber = typeof value === 'number' && Number.isFinite(value);
      const isInRange = isNumber && value >= rule.min && value <= rule.max;

      return isInRange ? undefined : `${name} takes a number from ${rule.min} to ${rule.max}, not ${String(value)}.`;
    }
    case 'choice':
      return typeof value === 'string' && rule.ids.includes(value)
        ? undefined
        : `${name} takes one of ${rule.ids.join(', ')}, not ${String(value)}.`;
    case 'toggle':
      return typeof value === 'boolean' ? undefined : `${name} takes true or false, not ${String(value)}.`;
  }
}

/**
 * Why a lesson would refuse `value` for the param `name`, or undefined when it takes it. Ask before setting a value
 * through the agent bridge, or when checking a tour or a state written by hand.
 */
export function valueProblem({
  lesson,
  name,
  value,
}: {
  readonly lesson: AnyLesson;
  readonly name: string;
  readonly value: unknown;
}): string | undefined {
  const param = new Map(Object.entries(lesson.params)).get(name);

  if (param === undefined) {
    const isDerived = Object.hasOwn(lesson.derived, name);

    return isDerived
      ? `${name} is a derived value, so it follows the params and cannot be set.`
      : `"${name}" is not a param. The params: ${Object.keys(lesson.params).join(', ')}.`;
  }

  return ruleProblem(name, ruleOf(param), value);
}

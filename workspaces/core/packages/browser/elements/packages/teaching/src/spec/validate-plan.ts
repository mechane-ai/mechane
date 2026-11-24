import { outlineAdvice } from './advice.ts';
import { chartNames } from './chart-names.ts';
import { explainerParts } from './explainer-guide.ts';
import { adviceAt, errorAt, fieldsOf, kindText, ruleProblem } from './findings.ts';
import type { LessonFinding, ValueRule } from './findings.ts';

/** What checking a lesson plan found. The plan is valid when no finding is an error; advice never blocks it. */
export type LessonPlanResult = { readonly isValid: boolean; readonly findings: ReadonlyArray<LessonFinding> };

type Fields = ReadonlyMap<string, unknown>;
type Checked<Value> = { readonly findings: ReadonlyArray<LessonFinding>; readonly value?: Value | undefined };

/** What the beats need to know about the values: each param's rule and every declared name. */
type Names = {
  readonly rules: ReadonlyMap<string, ValueRule>;
  readonly params: ReadonlySet<string>;
  readonly derived: ReadonlySet<string>;
};

/** One part of the plan to check, where it is, and the names the plan declares. */
type NamedInput = { readonly input: unknown; readonly path: string; readonly names: Names };

const PARAM_KINDS: ReadonlySet<string> = new Set(['number', 'choice', 'toggle']);
const ASK_KINDS: ReadonlySet<string> = new Set(['predict', 'challenge']);
const SCALES: ReadonlySet<string> = new Set(['linear', 'log']);
const NUMBER_KEYS = ['value', 'min', 'max', 'step'] as const;
const EARLY_BEATS = 3;
const KNOWN_PARTS: ReadonlyArray<string> = [...explainerParts, ...chartNames];

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function textAt(fields: Fields, key: string, path: string): ReadonlyArray<LessonFinding> {
  const value = fields.get(key);
  const actual = typeof value === 'string' ? 'an empty string' : kindText(value);

  return hasText(value) ? [] : [errorAt(`${path}.${key}`, `${key} must be a non-empty string, not ${actual}.`)];
}

function optionalTextAt(fields: Fields, key: string, path: string): ReadonlyArray<LessonFinding> {
  return fields.has(key) && fields.get(key) !== undefined ? textAt(fields, key, path) : [];
}

function numberAt(fields: Fields, key: string, path: string): ReadonlyArray<LessonFinding> {
  const value = fields.get(key);

  return typeof value === 'number' && Number.isFinite(value)
    ? []
    : [errorAt(`${path}.${key}`, `${key} must be a finite number, not ${kindText(value)}.`)];
}

function namesAt(fields: Fields, key: string, path: string): Checked<ReadonlyArray<string>> {
  const value = fields.get(key);

  if (!Array.isArray(value)) {
    return { findings: [errorAt(`${path}.${key}`, `${key} must be an array of names, not ${kindText(value)}.`)] };
  }

  const names = value.filter((item: unknown) => typeof item === 'string');

  return names.length === value.length
    ? { findings: [], value: names }
    : { findings: [errorAt(`${path}.${key}`, `${key} must hold only names, as strings.`)] };
}

function numberParam(fields: Fields, path: string): Checked<ValueRule> {
  const missing = NUMBER_KEYS.flatMap((key) => numberAt(fields, key, path));
  const scale = fields.get('scale');
  const isKnownScale = scale === undefined || (typeof scale === 'string' && SCALES.has(scale));
  const isFormat = fieldsOf(fields.get('format')) !== undefined;

  const shapes = [
    ...missing,
    ...(isKnownScale ? [] : [errorAt(`${path}.scale`, 'scale must be "linear" or "log".')]),
    ...(isFormat
      ? []
      : [
          errorAt(
            `${path}.format`,
            'format must be Intl.NumberFormat options, such as { "maximumFractionDigits": 2 }.',
          ),
        ]),
  ];

  if (missing.length > 0) {
    return { findings: shapes };
  }

  const [value, min, max, step] = NUMBER_KEYS.map((key) => Number(fields.get(key)));
  const rule: ValueRule = { kind: 'number', min: min ?? 0, max: max ?? 0 };
  const problem = ruleProblem('the default', rule, value);

  const findings = [
    ...shapes,
    ...(rule.min < rule.max ? [] : [errorAt(`${path}.max`, `max must be above min (${rule.min}).`)]),
    ...((step ?? 0) > 0 ? [] : [errorAt(`${path}.step`, 'step must be above zero.')]),
    ...(scale === 'log' && rule.min <= 0
      ? [
          errorAt(
            `${path}.min`,
            'A log scale needs min above zero. Use a linear scale, or start at a small positive value.',
          ),
        ]
      : []),
    ...(problem === undefined ? [] : [errorAt(`${path}.value`, problem)]),
  ];

  return findings.length > 0 ? { findings } : { findings, value: rule };
}

function choiceParam(fields: Fields, path: string): Checked<ValueRule> {
  const options = fields.get('options');

  if (!Array.isArray(options) || options.length === 0) {
    return { findings: [errorAt(`${path}.options`, 'options must be a non-empty array of { id, label }.')] };
  }

  const shaped = options.map((option: unknown, index) => {
    const optionFields = fieldsOf(option) ?? new Map<string, unknown>();
    const where = `${path}.options[${index}]`;

    return {
      id: optionFields.get('id'),
      findings: [...textAt(optionFields, 'id', where), ...textAt(optionFields, 'label', where)],
    };
  });

  const ids = shaped.map(({ id }) => String(id));

  const repeated = ids.flatMap((id, index) =>
    ids.indexOf(id) === index ? [] : [errorAt(`${path}.options[${index}].id`, `Two options share the id "${id}".`)],
  );

  const rule: ValueRule = { kind: 'choice', ids: [...new Set(ids)] };
  const problem = ruleProblem('the default', rule, fields.get('value'));

  const findings = [
    ...shaped.flatMap((item) => item.findings),
    ...repeated,
    ...(problem === undefined ? [] : [errorAt(`${path}.value`, problem)]),
  ];

  return findings.length > 0 ? { findings } : { findings, value: rule };
}

function paramAt(name: string, input: unknown): Checked<ValueRule> {
  const path = `params.${name}`;
  const fields = fieldsOf(input);

  if (fields === undefined) {
    return {
      findings: [errorAt(path, `A param must be an object with kind, label and value, not ${kindText(input)}.`)],
    };
  }

  const kind = String(fields.get('kind'));

  if (!PARAM_KINDS.has(kind)) {
    return { findings: [errorAt(`${path}.kind`, 'kind must be "number", "choice" or "toggle".')] };
  }

  const label = textAt(fields, 'label', path);

  const checked =
    kind === 'number'
      ? numberParam(fields, path)
      : kind === 'choice'
        ? choiceParam(fields, path)
        : toggleParam(fields, path);

  const findings = [...label, ...checked.findings];

  return findings.length > 0 ? { findings } : checked;
}

function toggleParam(fields: Fields, path: string): Checked<ValueRule> {
  return typeof fields.get('value') === 'boolean'
    ? { findings: [], value: { kind: 'toggle' } }
    : { findings: [errorAt(`${path}.value`, 'A toggle param opens at true or false.')] };
}

/**
 * Every path of reads from `start`, shortest first, reaching each name once. A path that comes back to `start` ends.
 *
 * @yields A path of names that begins at `start`.
 */
function* readPaths(
  graph: ReadonlyMap<string, ReadonlyArray<string>>,
  start: string,
): Generator<ReadonlyArray<string>> {
  const seen = new Set<string>();
  const level: { paths: ReadonlyArray<ReadonlyArray<string>> } = { paths: [[start]] };

  while (level.paths.length > 0) {
    yield* level.paths;

    level.paths = level.paths.flatMap((path) => {
      const last = path.at(-1) ?? start;
      const isClosed = path.length > 1 && last === start;

      const unseen = (isClosed ? [] : (graph.get(last) ?? [])).filter((name) => {
        const isUnseen = !seen.has(name);

        seen.add(name);

        return isUnseen;
      });

      return unseen.map((name) => [...path, name]);
    });
  }
}

/** The shortest loop of derived values that starts and ends at `start`, if one exists. */
function loopThrough(
  graph: ReadonlyMap<string, ReadonlyArray<string>>,
  start: string,
): ReadonlyArray<string> | undefined {
  return [...readPaths(graph, start)].find((path) => path.length > 1 && path.at(-1) === start);
}

function derivedAt({
  entries,
  params,
}: {
  readonly entries: ReadonlyArray<readonly [string, unknown]>;
  readonly params: ReadonlySet<string>;
}): Checked<ReadonlyMap<string, ReadonlyArray<string>>> {
  const order = entries.map(([name]) => name);
  const known = new Set([...params, ...order]);

  const checked = entries.map(([name, input]) => {
    const path = `derived.${name}`;
    const fields = fieldsOf(input);

    if (fields === undefined) {
      return {
        name,
        reads: [],
        findings: [errorAt(path, `A derived value must be an object with label, format, reads and formula.`)],
      };
    }

    const reads = namesAt(fields, 'reads', path);
    const unknown = (reads.value ?? []).filter((read) => !known.has(read));

    return {
      name,
      reads: reads.value ?? [],
      findings: [
        ...(params.has(name) ? [errorAt(path, `"${name}" is declared as both a param and a derived value.`)] : []),
        ...textAt(fields, 'label', path),
        ...textAt(fields, 'formula', path),
        ...(fieldsOf(fields.get('format')) === undefined
          ? [errorAt(`${path}.format`, 'format must be Intl.NumberFormat options.')]
          : []),
        ...reads.findings,
        ...unknown.map((read) =>
          errorAt(
            `${path}.reads`,
            `"${read}" is not a param or a derived value. Declare it, or read one of: ${[...known].join(', ')}.`,
          ),
        ),
      ],
    };
  });

  const graph = new Map(checked.map(({ name, reads }) => [name, reads.filter((read) => order.includes(read))]));

  const ordering = checked.flatMap(({ name, reads }) => {
    const later = reads.filter((read) => order.indexOf(read) >= order.indexOf(name));
    const loop = loopThrough(graph, name);

    if (loop !== undefined) {
      return [
        errorAt(
          `derived.${name}.reads`,
          `Derived values read each other in a loop: ${loop.join(' → ')}. Break the loop so each is computed from earlier values.`,
        ),
      ];
    }

    return later.map((read) =>
      errorAt(
        `derived.${name}.reads`,
        `"${name}" reads "${read}", which is declared after it. defineLesson computes in order, so move "${read}" above it.`,
      ),
    );
  });

  return { findings: [...checked.flatMap((item) => item.findings), ...ordering], value: graph };
}

function stateAt({ input, path, names }: NamedInput): ReadonlyArray<LessonFinding> {
  const fields = fieldsOf(input);

  if (fields === undefined) {
    return [errorAt(path, `A state must be an object with id, label and values, not ${kindText(input)}.`)];
  }

  const values = fieldsOf(fields.get('values'));

  const valueFindings = [...(values ?? [])].flatMap(([name, value]) => {
    const rule = names.rules.get(name);
    const where = `${path}.values.${name}`;

    if (rule !== undefined) {
      const problem = ruleProblem(name, rule, value);

      return problem === undefined ? [] : [errorAt(where, problem)];
    }

    if (names.derived.has(name)) {
      return [errorAt(where, `"${name}" is a derived value; a state sets params only, and the derived values follow.`)];
    }

    return names.params.has(name)
      ? []
      : [errorAt(where, `"${name}" is not a param. The params: ${[...names.params].join(', ')}.`)];
  });

  return [
    ...textAt(fields, 'id', path),
    ...textAt(fields, 'label', path),
    ...(values === undefined ? [errorAt(`${path}.values`, 'values must be an object of param names and values.')] : []),
    ...valueFindings,
  ];
}

function closePart(part: string): string | undefined {
  const wanted = part.toLowerCase();

  return KNOWN_PARTS.find((name) => name.toLowerCase().includes(wanted) || wanted.includes(name.toLowerCase()));
}

function figureAt({ input, path, names }: NamedInput): ReadonlyArray<LessonFinding> {
  const fields = fieldsOf(input);

  if (fields === undefined) {
    return [errorAt(path, 'figure must be an object with part and question.')];
  }

  const part = fields.get('part');
  const isKnown = typeof part === 'string' && KNOWN_PARTS.includes(part);
  const close = typeof part === 'string' && part.length > 0 ? closePart(part) : undefined;

  const hint =
    close === undefined ? ' Choose a part from explainerGuide or a chart from chartGuide.' : ` Did you mean ${close}?`;

  const shows = fields.has('shows') ? namesAt(fields, 'shows', path) : { findings: [], value: [] };
  const known = new Set([...names.params, ...names.derived]);

  return [
    ...(isKnown ? [] : [errorAt(`${path}.part`, `"${String(part)}" is not a teaching part or a chart.${hint}`)]),
    ...textAt(fields, 'question', path),
    ...shows.findings,
    ...(shows.value ?? []).flatMap((name) =>
      known.has(name) ? [] : [errorAt(`${path}.shows`, `"${name}" is not a param or a derived value.`)],
    ),
  ];
}

function askAt(input: unknown, path: string): ReadonlyArray<LessonFinding> {
  const fields = fieldsOf(input);

  if (fields === undefined) {
    return [errorAt(path, 'ask must be an object with kind and prompt.')];
  }

  return [
    ...(ASK_KINDS.has(String(fields.get('kind')))
      ? []
      : [errorAt(`${path}.kind`, 'kind must be "predict" or "challenge".')]),
    ...textAt(fields, 'prompt', path),
  ];
}

function hintsAt(fields: Fields, path: string): ReadonlyArray<LessonFinding> {
  if (!fields.has('hints')) {
    return [];
  }

  const checked = namesAt(fields, 'hints', path);

  return checked.findings.length > 0 ? [errorAt(`${path}.hints`, 'hints must be an array of sentences.')] : [];
}

function beatAt({
  input,
  index,
  names,
}: {
  readonly input: unknown;
  readonly index: number;
  readonly names: Names;
}): ReadonlyArray<LessonFinding> {
  const path = `beats[${index}]`;
  const fields = fieldsOf(input);

  if (fields === undefined) {
    return [errorAt(path, `A beat must be an object with id and title, not ${kindText(input)}.`)];
  }

  const steps = fields.get('steps');
  const isWhole = steps === undefined || (Number.isInteger(steps) && Number(steps) >= 0);
  const states = fields.get('states');
  const stateList = Array.isArray(states) ? states : [];
  const stateIds = stateList.map((state: unknown) => fieldsOf(state)?.get('id'));

  return [
    ...textAt(fields, 'id', path),
    ...textAt(fields, 'title', path),
    ...optionalTextAt(fields, 'goal', path),
    ...optionalTextAt(fields, 'misconception', path),
    ...hintsAt(fields, path),
    ...(isWhole ? [] : [errorAt(`${path}.steps`, 'steps must be a whole number from 0.')]),
    ...(states === undefined || Array.isArray(states) ? [] : [errorAt(`${path}.states`, 'states must be an array.')]),
    ...stateList.flatMap((state: unknown, stateIndex) =>
      stateAt({ input: state, path: `${path}.states[${stateIndex}]`, names }),
    ),
    ...stateIds.flatMap((id, stateIndex) =>
      stateIds.indexOf(id) === stateIndex
        ? []
        : [errorAt(`${path}.states[${stateIndex}].id`, `Two states of this beat share the id "${String(id)}".`)],
    ),
    ...(fields.get('figure') === undefined
      ? []
      : figureAt({ input: fields.get('figure'), path: `${path}.figure`, names })),
    ...(fields.get('ask') === undefined ? [] : askAt(fields.get('ask'), `${path}.ask`)),
  ];
}

function planAdvice({
  beats,
  derived,
}: {
  readonly beats: ReadonlyArray<Fields>;
  readonly derived: ReadonlyMap<string, ReadonlyArray<string>>;
}): ReadonlyArray<LessonFinding> {
  const isAskedEarly = beats.slice(0, EARLY_BEATS).some((beat) => beat.get('ask') !== undefined);
  const figures = beats.map((beat) => fieldsOf(beat.get('figure')));

  const drawn = new Set(
    figures.flatMap((figure) => {
      const shows = figure?.get('shows');

      return Array.isArray(shows) ? shows.map(String) : [];
    }),
  );

  const read = new Set([...derived.values()].flat());

  return [
    ...(isAskedEarly || beats.length === 0
      ? []
      : [
          adviceAt(
            'beats',
            'None of the first three beats asks for a prediction or a challenge. Add a Predict early, so the reader commits to a guess.',
          ),
        ]),
    ...figures.flatMap((figure, index) =>
      figure === undefined
        ? [
            adviceAt(
              `beats[${index}].figure`,
              'This beat shows no figure. Give it one, or fold its prose into the beat before.',
            ),
          ]
        : [],
    ),
    ...[...derived.keys()]
      .filter((name) => !drawn.has(name) && !read.has(name))
      .map((name) =>
        adviceAt(
          `derived.${name}`,
          `No figure shows "${name}" and no value reads it. List it in a figure's shows, or remove it.`,
        ),
      ),
  ];
}

/**
 * Checks a lesson plan an agent drafted, before any component is written. Errors are shapes and names `defineLesson`
 * would refuse; advice is teaching practice. Every finding has a path and a sentence that says what to do.
 */
export function validateLessonPlan(input: unknown): LessonPlanResult {
  const plan = fieldsOf(input);

  if (plan === undefined) {
    return {
      isValid: false,
      findings: [
        errorAt(
          '',
          `A lesson plan is an object with id, title, audience, idea, params and beats, not ${kindText(input)}.`,
        ),
      ],
    };
  }

  const params = fieldsOf(plan.get('params'));
  const derived = plan.get('derived') === undefined ? new Map<string, unknown>() : fieldsOf(plan.get('derived'));
  const beats = plan.get('beats');
  const beatList = Array.isArray(beats) ? beats : [];

  const checkedParams = [...(params ?? [])].map(([name, value]) => ({ name, ...paramAt(name, value) }));

  const rules = new Map(
    checkedParams.flatMap(({ name, value }) => (value === undefined ? [] : [[name, value] as const])),
  );

  const paramNames = new Set(checkedParams.map(({ name }) => name));
  const checkedDerived = derivedAt({ entries: [...(derived ?? [])], params: paramNames });
  const names: Names = { rules, params: paramNames, derived: new Set(derived?.keys()) };
  const beatFields = beatList.map((beat: unknown) => fieldsOf(beat) ?? new Map<string, unknown>());
  const beatIds = beatFields.map((beat) => beat.get('id'));

  const errors = [
    ...['id', 'title', 'audience', 'idea'].flatMap((key) =>
      textAt(plan, key, '').map((finding) => ({ ...finding, path: key })),
    ),
    ...(params === undefined ? [errorAt('params', 'params must be an object of named params.')] : []),
    ...checkedParams.flatMap(({ findings }) => findings),
    ...(derived === undefined ? [errorAt('derived', 'derived must be an object of named derived values.')] : []),
    ...checkedDerived.findings,
    ...(beatList.length === 0 ? [errorAt('beats', 'beats must be a non-empty array.')] : []),
    ...beatList.flatMap((beat: unknown, index) => beatAt({ input: beat, index, names })),
    ...beatIds.flatMap((id, index) =>
      beatIds.indexOf(id) === index ? [] : [errorAt(`beats[${index}].id`, `Two beats share the id "${String(id)}".`)],
    ),
  ];

  const defaults = Object.fromEntries(
    checkedParams.map(({ name }) => [name, fieldsOf(params?.get(name))?.get('value')]),
  );

  const advice = [
    ...outlineAdvice({
      defaults,
      beats: beatFields.map((beat, index) => {
        const states = beat.get('states');

        return {
          id: typeof beat.get('id') === 'string' ? String(beat.get('id')) : `#${index}`,
          title: typeof beat.get('title') === 'string' ? String(beat.get('title')) : '',
          hasGoal: hasText(beat.get('goal')),
          states: (Array.isArray(states) ? states : []).map((state: unknown) =>
            Object.fromEntries(fieldsOf(fieldsOf(state)?.get('values')) ?? []),
          ),
        };
      }),
    }),
    ...planAdvice({ beats: beatFields, derived: checkedDerived.value ?? new Map() }),
  ];

  return { isValid: errors.length === 0, findings: [...errors, ...advice] };
}

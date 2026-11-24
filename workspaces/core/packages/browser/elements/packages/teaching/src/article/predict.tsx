import * as stylex from '@stylexjs/stylex';
import { scrubTo } from '@ui-sdk/core/number';
import { useId, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import type { ValueFormat } from '../../../charts/src/index.ts';
import { Button, Row } from '../../../core/src/index.ts';
import { Field, RadioGroup, Slider } from '../../../forms/src/index.ts';
import { useLessonContext } from '../lesson/use-lesson.ts';
import { useArticle } from './article-context.ts';
import type { ArticleScope } from './article-context.ts';
import { BlockError, outsideText, unlistedText } from './article-error.tsx';
import { exerciseStyles } from './exercise-styles.ts';
import type { PredictionRecord } from './progress-store.ts';

/** The words of a prediction. Its result shows `youGuessed` and the guess, `answerIs` and the answer, and a verdict. */
export type PredictLabels = {
  readonly kicker: string;
  readonly yourGuess: string;
  readonly commit: string;
  readonly youGuessed: string;
  readonly answerIs: string;
  readonly right: string;
  readonly wrong: string;
  readonly showAnswer: string;
  readonly range: string;
  /** What an agent is told when it tries to commit for the reader. */
  readonly needsReader: string;
};

const defaultLabels: PredictLabels = {
  kicker: 'Predict',
  yourGuess: 'Your guess',
  commit: 'Lock in my guess',
  youGuessed: 'You guessed',
  answerIs: 'The answer is',
  right: 'Right.',
  wrong: 'Not quite.',
  showAnswer: 'Show the answer',
  range: 'Between',
  needsReader: 'Commits the reader’s own prediction; only the reader can make it.',
};

type PredictOption = { readonly id: string; readonly label: string };

/** A guess among options, one of which is right. */
export type ChoicePrediction = {
  readonly options: ReadonlyArray<PredictOption>;
  /** The id of the right option. */
  readonly answer: string;
};

/** A guessed number. The answer is a fixed number or a lesson value read when the reader commits. */
export type NumberPrediction = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: ValueFormat;
  /** How far a guess may be from the answer and still be right. Defaults to one step. */
  readonly tolerance?: number | undefined;
} & (
  | { readonly answer: number; readonly answerFrom?: undefined }
  | {
      /** A number param or derived value of the lesson whose value, when the reader commits, is the answer. */
      readonly answerFrom: string;
      readonly answer?: undefined;
    }
);

export type PredictProps = {
  /** The prediction's id, unique in the article. The reader's progress records the guess under it. */
  readonly id: string;
  /** The question, such as "At temperature 4, how much entropy is left?". */
  readonly prompt: ReactNode;
  /** The explanation, shown once the reader commits. Agents do not see it before then. */
  readonly children: ReactNode;
  readonly labels?: Partial<PredictLabels> | undefined;
} & (ChoicePrediction | NumberPrediction);

/** The answer and the text of a value, from the prediction's own answer or the lesson value it names. */
function answerOf(
  props: PredictProps,
  values: Readonly<Record<string, unknown>>,
): { readonly answer: number | string } | { readonly error: string } {
  if ('options' in props) {
    return props.options.some((option) => option.id === props.answer)
      ? { answer: props.answer }
      : { error: `Predict "${props.id}" has no option "${props.answer}" for its answer.` };
  }

  if (props.answerFrom === undefined) {
    return { answer: props.answer };
  }

  const value = values[props.answerFrom];

  return typeof value === 'number'
    ? { answer: value }
    : {
        error: `Predict "${props.id}" takes its answer from "${props.answerFrom}", which is not a number of the lesson.`,
      };
}

function valueText(props: PredictProps, value: number | string, locale: string): string {
  if ('options' in props) {
    return props.options.find((option) => option.id === value)?.label ?? String(value);
  }

  return typeof value === 'number' ? formatValue({ value, locale, format: props.format }) : value;
}

function isRight(props: PredictProps, guess: number | string, answer: number | string): boolean {
  if ('options' in props || typeof guess !== 'number' || typeof answer !== 'number') {
    return guess === answer;
  }

  return Math.abs(guess - answer) <= (props.tolerance ?? props.step);
}

function Result({
  props,
  record,
  article,
  words,
}: {
  readonly props: PredictProps;
  readonly record: PredictionRecord;
  readonly article: ArticleScope;
  readonly words: PredictLabels;
}): ReactNode {
  const guess = valueText(props, record.value, article.locale);
  const answer = valueText(props, record.answer, article.locale);

  return (
    <div role="status" {...stylex.props(exerciseStyles.result)}>
      <p {...stylex.props(exerciseStyles.verdict)}>
        <span {...stylex.props(record.isCorrect ? exerciseStyles.right : exerciseStyles.wrong)}>
          {record.isCorrect ? words.right : words.wrong}
        </span>{' '}
        {`${words.youGuessed} ${guess}. ${words.answerIs} ${answer}.`}
      </p>
      <div>{props.children}</div>
    </div>
  );
}

/**
 * Asks the reader to commit a guess before the answer shows: one of a few options, or a number on a slider. Once the
 * reader commits, the answer and the explanation appear and the reader's progress keeps the guess. An agent can read
 * the question but never commits for the reader, and does not see the answer before the reader commits.
 */
export function Predict(props: PredictProps): ReactNode {
  const { id, prompt, children, labels } = props;
  const article = useArticle();
  const { values } = useLessonContext();
  const words = { ...defaultLabels, ...labels };
  const promptId = useId();
  const start = 'options' in props ? null : scrubTo((props.min + props.max) / 2, props).value;
  const [draft, setDraft] = useState<number | string | null>(start);

  if (article === null) {
    return <BlockError>{outsideText('Predict')}</BlockError>;
  }

  if (!article.outline.predictions.some((item) => item.id === id)) {
    return <BlockError>{unlistedText('Predict', id)}</BlockError>;
  }

  const found = answerOf(props, values);

  if ('error' in found) {
    return <BlockError>{found.error}</BlockError>;
  }

  const record = article.progress.predictions[id];

  const header = (
    <>
      <p {...stylex.props(exerciseStyles.kicker)}>{words.kicker}</p>
      <div id={promptId} {...stylex.props(exerciseStyles.prompt)}>
        {prompt}
      </div>
    </>
  );

  if (article.view === 'static') {
    const choices = 'options' in props ? props.options.map((option) => option.label).join(' · ') : null;

    const range =
      'options' in props
        ? null
        : `${words.range} ${valueText(props, props.min, article.locale)} – ${valueText(props, props.max, article.locale)}`;

    return (
      <section aria-labelledby={promptId} {...stylex.props(exerciseStyles.box)}>
        {header}
        <p {...stylex.props(exerciseStyles.meta)}>{choices ?? range}</p>
        <details {...stylex.props(exerciseStyles.details)}>
          <summary {...stylex.props(exerciseStyles.summary)}>{words.showAnswer}</summary>
          <p
            {...stylex.props(exerciseStyles.verdict)}
          >{`${words.answerIs} ${valueText(props, found.answer, article.locale)}.`}</p>
          {children}
        </details>
      </section>
    );
  }

  function commit(event: MouseEvent): void {
    if (draft === null || 'error' in found || article === null) {
      return;
    }

    article.progressApi.commit(
      id,
      { value: draft, answer: found.answer, isCorrect: isRight(props, draft, found.answer) },
      { reason: 'commit', event: event.nativeEvent },
    );
  }

  const control =
    'options' in props ? (
      <RadioGroup.Root<string>
        value={typeof draft === 'string' ? draft : ''}
        onValueChange={(next) => setDraft(next)}
        aria-labelledby={promptId}
      >
        {props.options.map((option) => (
          <Field.Root key={option.id}>
            <Field.Label>
              <Row>
                <RadioGroup.Item value={option.id}>
                  <RadioGroup.Indicator />
                </RadioGroup.Item>
                {option.label}
              </Row>
            </Field.Label>
          </Field.Root>
        ))}
      </RadioGroup.Root>
    ) : (
      <Slider.Root<number>
        locale={article.locale}
        value={typeof draft === 'number' ? draft : props.min}
        onValueChange={(next) => setDraft(next)}
        min={props.min}
        max={props.max}
        step={props.step}
        format={props.format}
      >
        <Row shouldSpaceBetween>
          <Slider.Label>{words.yourGuess}</Slider.Label>
          <Slider.Value />
        </Row>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    );

  return (
    <section aria-labelledby={promptId} {...stylex.props(exerciseStyles.box)}>
      {header}
      {record === undefined ? (
        <div {...stylex.props(exerciseStyles.controls)}>
          {control}
          <div>
            <Button variant="solid" disabled={draft === null} data-agent-confirm={words.needsReader} onClick={commit}>
              {words.commit}
            </Button>
          </div>
        </div>
      ) : (
        <Result props={props} record={record} article={article} words={words} />
      )}
    </section>
  );
}

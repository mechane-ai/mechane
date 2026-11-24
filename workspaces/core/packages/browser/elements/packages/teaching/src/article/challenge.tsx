import * as stylex from '@stylexjs/stylex';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../core/src/index.ts';
import type { LessonValue } from '../lesson/define-lesson.ts';
import { useArticle } from './article-context.ts';
import { BlockError, outsideText, unlistedText } from './article-error.tsx';
import { exerciseStyles } from './exercise-styles.ts';

/** The words of a challenge. The hint button reads "Show a hint (1 of 3)": `hint`, then `of`. */
export type ChallengeLabels = {
  readonly kicker: string;
  readonly reached: string;
  readonly notYet: string;
  readonly hint: string;
  readonly of: string;
  readonly showOutcome: string;
};

const defaultLabels: ChallengeLabels = {
  kicker: 'Challenge',
  reached: 'Reached.',
  notYet: 'Not reached yet.',
  hint: 'Show a hint',
  of: 'of',
  showOutcome: 'Show what you find',
};

export type ChallengeProps = {
  /** The challenge's id, unique in the article. The reader's progress records it under this id. */
  readonly id: string;
  /** The task, such as "Make the top token at least 90% likely". */
  readonly prompt: ReactNode;
  /** Whether the lesson's values meet the task. It reads params and derived values by name. */
  readonly isReached: (values: Readonly<Record<string, LessonValue>>) => boolean;
  /** Hints the reader can ask for, one at a time. */
  readonly hints?: ReadonlyArray<string> | undefined;
  /** What the reader finds, shown once the challenge is reached. */
  readonly children: ReactNode;
  readonly labels?: Partial<ChallengeLabels> | undefined;
};

/**
 * A task the reader meets by changing the lesson's values: once a change of their own makes `isReached` true, the
 * challenge counts as reached and shows its outcome. A change an agent makes never reaches it.
 */
export function Challenge({ id, prompt, isReached, hints = [], children, labels }: ChallengeProps): ReactNode {
  const article = useArticle();
  const words = { ...defaultLabels, ...labels };
  const promptId = useId();
  const challenges = article?.challenges;

  useEffect(() => challenges?.add(id, isReached), [challenges, id, isReached]);

  if (article === null) {
    return <BlockError>{outsideText('Challenge')}</BlockError>;
  }

  const isDone = article.progress.reached.includes(id);
  const shown = Math.min(article.progress.hints[id] ?? 0, hints.length);

  const header = (
    <>
      {article.outline.challenges.some((item) => item.id === id) ? null : (
        <BlockError>{unlistedText('Challenge', id)}</BlockError>
      )}
      <p {...stylex.props(exerciseStyles.kicker)}>{words.kicker}</p>
      <div id={promptId} {...stylex.props(exerciseStyles.prompt)}>
        {prompt}
      </div>
    </>
  );

  if (article.view === 'static') {
    return (
      <section aria-labelledby={promptId} {...stylex.props(exerciseStyles.box)}>
        {header}
        {hints.length > 0 ? (
          <ol {...stylex.props(exerciseStyles.hints)}>
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>
        ) : null}
        <details {...stylex.props(exerciseStyles.details)}>
          <summary {...stylex.props(exerciseStyles.summary)}>{words.showOutcome}</summary>
          {children}
        </details>
      </section>
    );
  }

  return (
    <section aria-labelledby={promptId} {...stylex.props(exerciseStyles.box)}>
      {header}
      <p role="status" {...stylex.props(exerciseStyles.verdict)}>
        <span {...stylex.props(isDone ? exerciseStyles.right : exerciseStyles.meta)}>
          {isDone ? words.reached : words.notYet}
        </span>
      </p>
      {shown > 0 ? (
        <ol {...stylex.props(exerciseStyles.hints)}>
          {hints.slice(0, shown).map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ol>
      ) : null}
      {isDone ? <div>{children}</div> : null}
      {!isDone && shown < hints.length ? (
        <div {...stylex.props(exerciseStyles.actions)}>
          <Button
            density="compact"
            onClick={(event) => article.progressApi.showHint(id, { reason: 'hint-press', event: event.nativeEvent })}
          >
            {`${words.hint} (${shown + 1} ${words.of} ${hints.length})`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

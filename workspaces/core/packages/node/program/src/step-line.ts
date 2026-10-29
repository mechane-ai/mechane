import { Match } from 'effect';
import type { StepSubject } from './schemas.ts';
import type { StepFailure } from './types.ts';

/** The text of each kind of step subject in a failed step's diagnostic, by the subject's tag. */
type SubjectTexts = {
  readonly [Tag in StepSubject['_tag']]: (subject: Extract<StepSubject, Readonly<Record<'_tag', Tag>>>) => string;
};

/** How a failed step's diagnostic names each kind of subject. */
const SUBJECT_TEXTS: Readonly<SubjectTexts> = {
  Path: ({ path }) => path,
  Url: ({ url }) => url.href,
  Command: ({ args }) => args.join(' '),
  Revision: ({ revision }) => `revision ${revision}`,
  Release: ({ release }) => `release ${release}`,
  Target: ({ target }) => `target ${target}`,
  Tag: ({ tag }) => `tag ${tag}`,
  Version: ({ version }) => `version ${version}`,
  BucketObject: ({ bucket, key }) => `${key} in ${bucket}`,
};

/**
 * The diagnostic line of a program's failed step: the step, what it acted on in parentheses when it names anything, and
 * the dependency's reason, such as `run git (git describe --exact-match HEAD): exit 128`.
 */
export function stepLine<S extends string>({ step, subjects, reason }: StepFailure<S>): string {
  const texts = subjects.map((subject) => Match.valueTags(subject, SUBJECT_TEXTS));

  const named: string = (() => {
    if (texts.length === 0) {
      return step;
    }

    return `${step} (${texts.join(', ')})`;
  })();

  return `${named}: ${reason}`;
}

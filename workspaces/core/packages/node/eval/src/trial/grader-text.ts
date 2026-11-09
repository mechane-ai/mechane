import { NOTIFICATION_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { Case } from '../schemas.ts';

/** What heads each part of a grader's notification, on a line of its own. */
const GraderHeading = { Input: '# Input', Expectation: '# Expectation', Reply: '# Reply' } as const;

/** Reserve room for the omission count when an answer exceeds the notification limit. */
const OMISSION_NOTE_MAX_CHARS = 80;

type GraderTextInput = { readonly evalCase: Case; readonly reply: string };

/**
 * The grader's notification: the case's input, each expectation under its id, and the subject's reply, each below a
 * heading line. A reply too long for the item is cut, and its last line says how many characters the item leaves out.
 */
export function graderText({ evalCase, reply }: GraderTextInput): string {
  const expectationLines: (expectation: Case['expectations'][number]) => ReadonlyArray<string> = ({
    id,
    description,
  }) => [`${GraderHeading.Expectation} ${id}`, description, ''];

  const expectations = evalCase.expectations.flatMap(expectationLines);
  const head = [GraderHeading.Input, evalCase.input, '', ...expectations, GraderHeading.Reply, ''].join('\n');

  if (head.length + reply.length <= NOTIFICATION_TEXT_MAX_CHARS) {
    return `${head}${reply}`;
  }

  const keptChars = NOTIFICATION_TEXT_MAX_CHARS - head.length - OMISSION_NOTE_MAX_CHARS;
  // The notification must remain well-formed even when truncation splits a UTF-16 pair.
  const kept = reply.slice(0, keptChars).toWellFormed();

  return `${head}${kept}\n[the reply goes on for ${reply.length - keptChars} characters this item leaves out]`;
}

import { INBOX_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { Case } from '../schemas.ts';

/** What heads each part of a grader's inbox item, on a line of its own. */
const GraderHeading = { Input: '# Input', Expectation: '# Expectation', Reply: '# Reply' } as const;

/** The characters a grader's inbox item keeps for the line that says how much of a long reply it left out. */
const OMISSION_NOTE_MAX_CHARS = 80;

type GraderTextInput = { readonly evalCase: Case; readonly reply: string };

/**
 * The grader's inbox item: the case's input, each expectation under its id, and the subject's reply, each below a
 * heading line. A reply too long for the item is cut, and its last line says how many characters the item leaves out.
 */
export function graderText({ evalCase, reply }: GraderTextInput): string {
  const expectationLines: (expectation: Case['expectations'][number]) => ReadonlyArray<string> = ({
    id,
    description,
  }) => [`${GraderHeading.Expectation} ${id}`, description, ''];

  const expectations = evalCase.expectations.flatMap(expectationLines);
  const head = [GraderHeading.Input, evalCase.input, '', ...expectations, GraderHeading.Reply, ''].join('\n');

  if (head.length + reply.length <= INBOX_TEXT_MAX_CHARS) {
    return `${head}${reply}`;
  }

  const keptChars = INBOX_TEXT_MAX_CHARS - head.length - OMISSION_NOTE_MAX_CHARS;
  // A cut between the two halves of a character's UTF-16 pair keeps a lone half, which no inbox item holds, so the
  // kept half becomes U+FFFD.
  const kept = reply.slice(0, keptChars).toWellFormed();

  return `${head}${kept}\n[the reply goes on for ${reply.length - keptChars} characters this item leaves out]`;
}

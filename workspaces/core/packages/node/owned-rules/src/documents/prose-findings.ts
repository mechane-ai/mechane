import type { Finding } from '@mechane/checks-kernel';
import { Option } from 'effect';
import { blockFindings } from './block-findings.ts';
import { proseBlocks } from './prose-blocks.ts';
import { wordsOf } from './words-of.ts';

/** A fenced code block, whose words the budget does not count. */
const FENCED_CODE = /^```[^\n]*\n[\s\S]*?^```$/m;

/** A document: its path, its text, and the words it may hold outside code blocks. */
type DocumentInput = {
  readonly path: string;
  readonly text: string;
  /** Absent for a document that no word budget bounds, whose prose alone the check reads. */
  readonly maxWords: Option.Option<number>;
};

/** Every word outside code blocks counts toward the budget, headings and tables included. */
function budgetFindings({ path, text, maxWords }: DocumentInput): ReadonlyArray<Finding> {
  const outsideCode = text.split(FENCED_CODE).join('\n');
  const words = wordsOf({ text: outsideCode }).length;

  /** The finding of a document past its budget. */
  const budgetFinding: (budgetWords: number) => Finding = (budgetWords) => ({
    check: 'documents',
    location: path,
    message: `Cut the document to ${budgetWords} words, such as \`[the guide](guide.md)\` in place of a section, since it holds ${words}`,
  });

  return Option.toArray(maxWords)
    .filter((budgetWords) => words > budgetWords)
    .map(budgetFinding);
}

/** Checks a document's word budget, if it has one, and the length of each sentence and paragraph of its prose. */
export function proseFindings({ path, text, maxWords }: DocumentInput): ReadonlyArray<Finding> {
  const blocks = proseBlocks({ text });

  return [...budgetFindings({ path, text, maxWords }), ...blocks.flatMap((block) => blockFindings({ path, block }))];
}

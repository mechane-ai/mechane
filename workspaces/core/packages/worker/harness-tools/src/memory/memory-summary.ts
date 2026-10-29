/** The longest summary the memory section shows of a memory, in code points of its first line. */
const SUMMARY_MAX_CHARS = 80;

type SummaryInput = { readonly text: string };

/** A memory's first line, trimmed and cut to the memory section's length. */
export function memorySummary({ text }: SummaryInput): string {
  const [firstLine = ''] = text.split('\n', 1);
  const codePoints = Array.from(firstLine.trim());

  if (codePoints.length <= SUMMARY_MAX_CHARS) {
    return codePoints.join('');
  }

  return `${codePoints.slice(0, SUMMARY_MAX_CHARS).join('')}…`;
}

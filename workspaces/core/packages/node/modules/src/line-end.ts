/** A file's text, and the offset where a statement ends. */
type LineEndInput = { readonly text: string; readonly offset: number };

/** The offset after the line break that ends a statement's line, so a statement that goes takes its line with it. */
export function lineEnd({ text, offset }: LineEndInput): number {
  if (text.startsWith('\n', offset)) {
    return offset + 1;
  }

  return offset;
}

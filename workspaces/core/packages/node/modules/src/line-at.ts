type LineAtInput = { readonly text: string; readonly offset: number };

/** The line, counted from 1, that holds `offset`. */
export function lineAt({ text, offset }: LineAtInput): number {
  return text.slice(0, offset).split('\n').length;
}

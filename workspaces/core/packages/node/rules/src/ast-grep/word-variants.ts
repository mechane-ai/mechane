type WordVariantsInput = { readonly words: ReadonlyArray<string> };

/** A word list as one alternation of its words as written, capitalized, and in upper case. */
type WordVariants = { readonly plain: string; readonly capital: string; readonly upper: string };

/** A word list as one alternation in each case style a name can use. */
export function wordVariants({ words }: WordVariantsInput): WordVariants {
  const capitalized: (word: string) => string = (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

  return {
    plain: words.join('|'),
    capital: words.map(capitalized).join('|'),
    upper: words.map((word) => word.toUpperCase()).join('|'),
  };
}

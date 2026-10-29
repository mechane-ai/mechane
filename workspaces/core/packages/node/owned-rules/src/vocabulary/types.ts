/** A synonym the glossary replaces, as it reads and as lowercase words, first and rest, and the word to say instead. */
export type BannedPhrase = {
  readonly phrase: string;
  readonly first: string;
  readonly rest: ReadonlyArray<string>;
  readonly headword: string;
};

/** A run of words in which a phrase may occur, such as one identifier or one clause, and the offset it starts at. */
export type WordRun = { readonly words: ReadonlyArray<string>; readonly offset: number };

/** A banned phrase found in a run, and the offset the run starts at. */
export type FoundPhrase = { readonly offset: number; readonly phrase: BannedPhrase };

/** A paragraph or list item of a document, with the line it starts on. */
export type Block = { readonly line: number; readonly text: string; readonly isListItem: boolean };

export type TextInput = { readonly text: string };

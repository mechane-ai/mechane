/** A name a file exports, whether it is a type, and its export statement's start and text. */
export type ExportedName = {
  readonly name: string;
  readonly isType: boolean;
  readonly start: number;
  readonly declaration: string;
};

import type { OperationName } from '@mechane/protocol';
import type { Schema } from 'effect';
import type { CommandShape, FlagKind } from './constants.ts';

/** A positional argument a command requires after its words, such as the id of the key to revoke. */
type ArgumentDeclaration = { readonly name: string; readonly summary: string };

/** One command of the model: what it does, how it writes, what it calls, and the flags and arguments it reads. */
export type CommandDeclaration = {
  readonly summary: string;
  readonly shape: CommandShape;
  /** The catalog operations the command calls, in the order it calls them. */
  readonly operations: ReadonlyArray<OperationName>;
  /** The flags only this command accepts, keyed by their long name; its input decides which it requires. */
  readonly flags: Readonly<Record<string, FlagDeclaration>>;
  readonly arguments: ReadonlyArray<ArgumentDeclaration>;
  /**
   * Decodes the command's flags and arguments, under their declared names, into the input its run reads. A flag its
   * encoded side marks optional is one the command does not require.
   */
  readonly input: Schema.Codec<object, unknown>;
};

/** A flag: how it reads its value, and what it does. */
export type FlagDeclaration = { readonly kind: FlagKind; readonly summary: string };

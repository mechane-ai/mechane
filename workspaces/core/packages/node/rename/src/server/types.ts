import type { LanguageServer } from '../types.ts';

/** A request or a notification to the server: its method and its parameters. */
export type RequestInput = { readonly server: LanguageServer; readonly method: string; readonly params: unknown };

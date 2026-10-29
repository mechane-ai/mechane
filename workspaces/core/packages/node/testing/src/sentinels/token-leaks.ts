import { TOKEN_SHAPE } from '@mechane/program';
import type { SearchedText } from '../types.ts';

type TokenLeaksInput = { readonly texts: ReadonlyArray<SearchedText>; readonly secrets: ReadonlyArray<string> };

/**
 * The name of each text that holds a token by its shape, or one of the secrets the stack staged, which never quotes the
 * token or the secret itself.
 */
export function tokenLeaks({ texts, secrets }: TokenLeaksInput): ReadonlyArray<string> {
  const isLeak: (searched: SearchedText) => boolean = ({ text }) =>
    TOKEN_SHAPE.test(text) || secrets.some((secret) => text.includes(secret));

  return texts.filter(isLeak).map(({ name }) => name);
}

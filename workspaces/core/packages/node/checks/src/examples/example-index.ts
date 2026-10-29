import { parsedText } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import type { OwnedExample } from '@mechane/rule-shapes';
import { Record } from 'effect';
import type { ExampleIndex, ExampleWorkspace } from './types.ts';

/** One example of an owned rule, and what its index shares with the workspace. */
type ExampleInput = { readonly example: OwnedExample; readonly workspace: ExampleWorkspace };

/** An example's tree as the checks read the workspace: its files, each TypeScript file parsed once. */
export function exampleIndex({ example, workspace }: ExampleInput): ExampleIndex {
  const files = Record.toEntries(example).map(([path, text]) => ({ path, text }));

  return {
    ...workspace,
    files,
    sources: files.filter(({ path }) => path.endsWith(TYPESCRIPT_EXTENSION)).map((file) => parsedText(file)),
  };
}

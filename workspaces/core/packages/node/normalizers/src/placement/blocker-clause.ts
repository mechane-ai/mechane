import { BlockerKind } from '@mechane/modules';
import type { Blocker } from '@mechane/modules';

/** What a site says of each blocker but a hidden need, which names the declarations its file does not export. */
const BLOCKER_CLAUSES: Readonly<Record<Exclude<BlockerKind, typeof BlockerKind.HiddenNeed>, string>> = {
  [BlockerKind.Cycle]: ', with what it needs, since its move alone would close an import cycle',
  [BlockerKind.RoleOrder]: ", by hand, since an import it needs there breaks the role files' order",
  [BlockerKind.Landing]: ', by hand, since it would land above a declaration it reads',
  [BlockerKind.Binding]: ', by hand, since its destination binds a name it takes to another declaration',
};

/** The blocker that keeps a declaration where it is. */
type BlockerClauseInput = { readonly blocker: Blocker };

/** What a site says of the blocker that keeps its declaration where it is. */
export function blockerClause({ blocker }: BlockerClauseInput): string {
  if (blocker.kind === BlockerKind.HiddenNeed) {
    /** The name as code. */
    const quoted: (name: string) => string = (name) => `\`${name}\``;
    const names = blocker.names.map(quoted).join(', ');

    return `, once its file exports ${names}, which it needs`;
  }

  return BLOCKER_CLAUSES[blocker.kind];
}

import { folderPrefixPath } from '@mechane/checks-kernel';
import type { Member } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import { Array, Option, Order } from 'effect';

/** The deepest folder first, which holds a path that a member around it also holds. */
const DEEPEST_FIRST = Order.flip(Order.mapInput(Order.Number, ({ folder }: Member) => folder.length));

type HoldingMemberInput = { readonly path: string; readonly members: ReadonlyArray<Member> };

/** The member whose folder holds `path`, the deepest first; none for installed packages and runtime modules. */
export function holdingMember({ path, members }: HoldingMemberInput): Option.Option<Member> {
  const isSource = path.endsWith(TYPESCRIPT_EXTENSION) || path.endsWith('.tsx');

  if (path.includes('node_modules') || !isSource) {
    return Option.none();
  }

  const holds: (member: Member) => boolean = (member) =>
    member.folder === '' || path.startsWith(folderPrefixPath({ folder: member.folder }));

  return Array.head(Array.sort(members.filter(holds), DEEPEST_FIRST));
}

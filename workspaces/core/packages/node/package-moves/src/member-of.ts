import { folderPrefixPath } from '@mechane/checks-kernel';
import { Array, Order } from 'effect';
import type { PlacedMember, StepLayout } from './packages.types.ts';

/** A step's layout and a path relative to the workspace. */
type LayoutPathInput = { readonly layout: StepLayout; readonly path: string };

/** The deepest folder first, which holds a path that a package around it also holds. */
const DEEPEST_FIRST = Order.flip(Order.mapInput(Order.Number, ({ folder }: PlacedMember) => folder.length));

/** The member that holds a path after the step: the package of the deepest folder that holds it, else the root. */
export function memberOf({ layout, path }: LayoutPathInput): PlacedMember {
  /** Whether the package's folder holds the path. */
  const isHolding: (member: PlacedMember) => boolean = ({ folder }) => path.startsWith(folderPrefixPath({ folder }));
  const holding = layout.packages.filter(isHolding);

  return Array.match(Array.sort(holding, DEEPEST_FIRST), {
    onEmpty: () => layout.root,
    onNonEmpty: ([deepest]) => deepest,
  });
}

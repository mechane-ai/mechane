import type { ModuleExportName } from 'oxc-parser';
import { NodeType } from '../constants.ts';

type ModuleNameInput = { readonly node: ModuleExportName };

/** The name a module exports or a statement binds, written as an identifier or, rarely, as a string. */
export function moduleName({ node }: ModuleNameInput): string {
  if (node.type === NodeType.Literal) {
    return node.value;
  }

  return node.name;
}

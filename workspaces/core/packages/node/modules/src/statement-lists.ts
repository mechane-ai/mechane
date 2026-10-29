import { Visitor } from 'oxc-parser';
import type { BlockStatement, Program, StaticBlock, SwitchCase, TSModuleBlock } from 'oxc-parser';
import type { ListedStatement } from './types.ts';

type StatementListsInput = { readonly program: Program };

/** Each list of statements a file holds: its program's, and each block's, switch case's and namespace's. */
export function statementLists({ program }: StatementListsInput): ReadonlyArray<ReadonlyArray<ListedStatement>> {
  const lists: Array<ReadonlyArray<ListedStatement>> = [program.body];

  /** Keeps the statements of a block, a static block or a namespace. */
  const keepBody: (node: BlockStatement | StaticBlock | TSModuleBlock) => void = (node) => {
    lists.push(node.body);
  };

  /** Keeps the statements of a switch case. */
  const keepCase: (node: SwitchCase) => void = (node) => {
    lists.push(node.consequent);
  };

  new Visitor({ BlockStatement: keepBody, StaticBlock: keepBody, TSModuleBlock: keepBody, SwitchCase: keepCase }).visit(
    program,
  );

  return lists;
}

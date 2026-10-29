import { Visitor } from 'oxc-parser';
import type { ImportExpression, MetaProperty } from 'oxc-parser';
import type { ProgramInput } from './types.ts';

/**
 * The offsets of the expressions whose value depends on the file's place: `import.meta` and a dynamic `import()`. A
 * declaration that holds one keeps its folder.
 */
export function locatedOffsets({ program }: ProgramInput): ReadonlyArray<number> {
  const offsets: Array<number> = [];

  /** Keeps where a located expression starts. */
  const keepOffset: (node: MetaProperty | ImportExpression) => void = (node) => {
    offsets.push(node.start);
  };

  new Visitor({ MetaProperty: keepOffset, ImportExpression: keepOffset }).visit(program);

  return offsets;
}

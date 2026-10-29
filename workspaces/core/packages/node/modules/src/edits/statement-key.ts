import { Option } from 'effect';
import type { StatementForm } from '../types.ts';

/** What makes two statements one: their kind, whether they take types only, and the file or package they name. */
export function statementKey({ kind, isTypeOnly, target, specifier }: StatementForm): string {
  return `${kind} ${String(isTypeOnly)} ${Option.getOrElse(target, () => specifier)}`;
}

import { publicClaudeId } from './managed-offers.ts';

const positionalModels: ReadonlySet<string> = new Set([
  'claude-fable-5-2',
  'claude-mythos-5-2',
  'claude-fable-5-1',
  'claude-mythos-5-1',
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
]);

export function supportsManagedSystemMessages(id: string): boolean {
  const model = (publicClaudeId(id) ?? id).replace(/-\d{8}$/u, '');

  return positionalModels.has(model);
}

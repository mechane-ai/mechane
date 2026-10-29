type SpellsStemInput = { readonly name: string; readonly stem: string };

/**
 * Whether a name spells a kebab-case stem: `start-stack` is spelled by `startStack`, `StartStack` and `START_STACK`,
 * and `start-fake-github` by `startFakeGitHub`, whose word keeps its own capitals.
 */
export function spellsStem({ name, stem }: SpellsStemInput): boolean {
  return name.replaceAll('_', '').toLowerCase() === stem.replaceAll('-', '').toLowerCase();
}

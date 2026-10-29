/** The plugin oxlint names its core rules under, which a configuration names without a prefix. */
const CORE_PLUGIN = 'eslint';

type ConfigurationNameInput = { readonly plugin: string; readonly rule: string };

/** A configuration names a core rule bare, as `no-console`, and a plugin's as `plugin/rule`. */
export function configurationName({ plugin, rule }: ConfigurationNameInput): string {
  if (plugin === CORE_PLUGIN) {
    return rule;
  }

  return `${plugin}/${rule}`;
}

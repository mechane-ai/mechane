/** The plugin oxlint names its core rules under, which a configuration names without a prefix. */
const CORE_PLUGIN = 'eslint';

/** Oxlint reports hook diagnostics under the upstream plugin name but configures them through its React plugin. */
const REACT_HOOKS_PLUGIN = 'react-hooks';
const REACT_PLUGIN = 'react';

type ConfigurationNameInput = { readonly plugin: string; readonly rule: string };

/** A configuration names a core rule bare, as `no-console`, and a plugin's as `plugin/rule`. */
export function configurationName({ plugin, rule }: ConfigurationNameInput): string {
  if (plugin === CORE_PLUGIN) {
    return rule;
  }

  const configuredPlugin: string = (() => {
    if (plugin === REACT_HOOKS_PLUGIN) {
      return REACT_PLUGIN;
    }

    return plugin;
  })();

  return `${configuredPlugin}/${rule}`;
}

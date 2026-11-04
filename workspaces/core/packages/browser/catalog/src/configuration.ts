import type { StorybookConfig } from '@storybook/react-vite';
import { stylexPlugin } from './stylex-plugin.ts';

type CatalogConfigurationInput = { readonly stories: ReadonlyArray<string>; readonly viteConfigurationPath: string };

/** Both catalogs compile StyleX and expose the same documentation, accessibility, and theme controls. */
export function catalogConfiguration({
  stories,
  viteConfigurationPath,
}: CatalogConfigurationInput): Readonly<StorybookConfig> {
  return {
    framework: { name: '@storybook/react-vite', options: { builder: { viteConfigPath: viteConfigurationPath } } },
    addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
    stories: [...stories],
    viteFinal: (configuration) => ({ ...configuration, plugins: [...(configuration.plugins ?? []), stylexPlugin] }),
  };
}

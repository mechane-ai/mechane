import type { StorybookConfig } from '@storybook/react-vite';
import stylex from '@stylexjs/unplugin/vite';
import type { PluginOption } from 'vite';

// oxlint-disable-next-line typescript/no-unsafe-assignment -- StyleX declares any for its Vite plugin.
const stylexPlugin: Readonly<PluginOption> = stylex({
  useCSSLayers: true,
  runtimeInjection: false,
  unstable_moduleResolution: { type: 'commonJS' },
});

const storybook: Readonly<StorybookConfig> = {
  framework: {
    name: '@storybook/react-vite',
    options: { builder: { viteConfigPath: new URL('vite.config.ts', import.meta.url).pathname } },
  },
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  stories: ['../src/stories/**/*.stories.tsx', '../../ui/packages/**/*.stories.tsx'],
  viteFinal: (configuration) => ({ ...configuration, plugins: [...(configuration.plugins ?? []), stylexPlugin] }),
};

export default storybook;

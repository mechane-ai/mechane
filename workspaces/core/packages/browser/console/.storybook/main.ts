import type { StorybookConfig } from '@storybook/react-vite';
import stylex from '@stylexjs/unplugin/vite';
import type { PluginOption } from 'vite';

// oxlint-disable-next-line typescript/no-unsafe-assignment -- StyleX declares any for its Vite plugin.
const stylexPlugin: PluginOption = stylex({
  useCSSLayers: true,
  runtimeInjection: false,
  unstable_moduleResolution: { type: 'commonJS' },
});

const storybook: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: { builder: { viteConfigPath: new URL('vite.config.ts', import.meta.url).pathname } },
  },
  stories: ['../src/stories/*.stories.tsx'],
  viteFinal: (config) => ({ ...config, plugins: [...(config.plugins ?? []), stylexPlugin] }),
};

export default storybook;

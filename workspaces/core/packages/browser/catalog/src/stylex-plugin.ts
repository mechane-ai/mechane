import stylex from '@stylexjs/unplugin/vite';
import type { PluginOption } from 'vite';
import { stylexTokenLayers } from './stylex-token-layers.ts';

/** Builds and catalogs extract the same StyleX layers and resolve defining modules the same way. */
// oxlint-disable-next-line typescript/no-unsafe-assignment -- StyleX declares any for its Vite plugin.
export const stylexPlugin: PluginOption = stylex({
  useCSSLayers: true,
  runtimeInjection: false,
  unstable_moduleResolution: { type: 'commonJS' },
  lightningcssOptions: { visitor: stylexTokenLayers },
});

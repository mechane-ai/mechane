import { catalogConfiguration } from '@mechane/catalog';
import { catalogManifests } from './catalog-manifest.ts';

const base = catalogConfiguration({
  stories: ['../packages/**/*.stories.tsx', '../src/stories/recipes/*.stories.tsx'],
  viteConfigurationPath: new URL('vite.config.ts', import.meta.url).pathname,
});

const configuration = {
  ...base,
  addons: [...(base.addons ?? []), '@storybook/addon-mcp'],
  experimental_manifests: catalogManifests,
  features: { componentsManifest: true },
} as const;

export default configuration;

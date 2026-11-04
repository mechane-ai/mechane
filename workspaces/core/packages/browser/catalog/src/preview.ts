import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview, ReactRenderer } from '@storybook/react-vite';

type CatalogPreviewInput = {
  readonly themes: Readonly<Record<'light' | 'dark', string>>;
  readonly order: ReadonlyArray<string>;
  readonly layout: 'padded' | 'fullscreen';
  readonly tags: ReadonlyArray<string>;
};

/** Catalogs exercise the real components without creating a second automated test suite. */
export function catalogPreview({ themes, order, layout, tags }: CatalogPreviewInput): Readonly<Preview> {
  return {
    tags: [...tags, '!test'],
    decorators: [withThemeByClassName<ReactRenderer>({ themes, defaultTheme: 'light' })],
    parameters: {
      layout,
      a11y: { test: 'off' },
      options: { storySort: { order: [...order] } },
      viewport: {
        options: { narrow: { name: 'Narrow phone', styles: { width: '360px', height: '800px' }, type: 'mobile' } },
      },
    },
  };
}

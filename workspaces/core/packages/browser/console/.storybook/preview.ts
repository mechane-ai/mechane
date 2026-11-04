import { themeProps } from '@mechane-ai/elements/theme';
import { catalogPreview } from '@mechane/catalog/preview';
import '@mechane-ai/elements/styles.css';
import './styles.css';

export default catalogPreview({
  themes: { light: themeProps.light.className ?? '', dark: themeProps.dark.className ?? '' },
  order: ['Screens'],
  layout: 'fullscreen',
  tags: ['autodocs'],
});

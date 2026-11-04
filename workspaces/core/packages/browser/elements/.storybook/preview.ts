import { themeProps } from '@mechane-ai/elements/theme';
import { colors } from '@mechane-ai/elements/tokens.stylex';
import { catalogPreview } from '@mechane/catalog/preview';
import * as stylex from '@stylexjs/stylex';
import '@mechane-ai/elements/styles.css';
import './styles.css';

const styles = stylex.create({ canvas: { backgroundColor: colors.surface } });

const canvas = stylex.props(styles.canvas).className ?? '';

export default catalogPreview({
  themes: {
    light: `${canvas} ${themeProps.light.className ?? ''}`,
    dark: `${canvas} ${themeProps.dark.className ?? ''}`,
  },
  order: [
    'Foundations',
    'Layout',
    'Controls',
    'Forms',
    'Navigation',
    'Overlays',
    'Feedback',
    'Data display',
    'Collections',
    'Content',
    'AI',
    'Charts',
  ],
  layout: 'padded',
  tags: ['autodocs', 'supported'],
});

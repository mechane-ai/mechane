import { themeProps } from '@mechane-ai/ui';
import { colors } from '@mechane-ai/ui/tokens.stylex';
import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview, Renderer } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import '@mechane-ai/ui/styles.css';
import './styles.css';

const styles = stylex.create({ canvas: { backgroundColor: colors.surface } });

const canvas = stylex.props(styles.canvas).className ?? '';

const preview: Readonly<Preview> = {
  tags: ['autodocs', 'supported', '!test'],
  decorators: [
    withThemeByClassName<Renderer>({
      themes: {
        light: `${canvas} ${themeProps.light.className ?? ''}`,
        dark: `${canvas} ${themeProps.dark.className ?? ''}`,
      },
      defaultTheme: 'light',
    }),
  ],
  parameters: {
    layout: 'padded',
    a11y: { test: 'off' },
    options: {
      storySort: {
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
          'Screens',
        ],
      },
    },
    viewport: {
      options: { narrow: { name: 'Narrow phone', styles: { width: '360px', height: '800px' }, type: 'mobile' } },
    },
  },
};

export default preview;

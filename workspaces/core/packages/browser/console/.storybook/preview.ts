import type { Preview } from '@storybook/react-vite';
import '@mechane-ai/ui/styles.css';
import './styles.css';

const preview: Readonly<Preview> = {
  tags: ['autodocs', 'supported', '!test'],
  parameters: {
    layout: 'padded',
    a11y: { test: 'off' },
    options: {
      storySort: { order: ['Foundations', 'Controls', 'Forms', 'Overlays', 'Layout', 'Data', 'Charts', 'Screens'] },
    },
    viewport: {
      options: { narrow: { name: 'Narrow phone', styles: { width: '360px', height: '800px' }, type: 'mobile' } },
    },
  },
};

export default preview;

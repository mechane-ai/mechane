import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsequentialForm } from '../../../recipes/consequential-form.tsx';

const meta = {
  title: 'Recipes/Consequential Form',
  component: ConsequentialForm,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ConsequentialForm>;

export default meta;

export const Example: StoryObj<typeof meta> = {
  args: {
    projectId: 'release-notes',
    project: 'Release notes',
    onArchive: () => {
      const operation = Promise.withResolvers<void>();

      setTimeout(operation.resolve, 400);

      return operation.promise;
    },
  },
};

export const Failed: StoryObj<typeof meta> = {
  args: {
    ...Example.args,
    projectId: 'release-notes',
    project: 'Release notes',
    onArchive: () => Promise.reject(new Error('Project is locked.')),
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Stack, Text } from '../../core/src/index.ts';
import { PageLayout, PageSection } from './page-layout.tsx';

const meta = { title: 'Layout/PageLayout', component: PageLayout, parameters: { layout: 'fullscreen' } } satisfies Meta<
  typeof PageLayout
>;

export default meta;

export const Report: StoryObj = {
  render: () => (
    <PageLayout
      title="Work overview"
      navigation={{
        label: 'Work views',
        items: [
          { id: 'overview', label: 'Overview', href: '#overview' },
          { id: 'history', label: 'History', href: '#history' },
        ],
        selectedId: 'overview',
        actions: <Button>Filters</Button>,
      }}
    >
      {['Outcomes', 'Unresolved age', 'Time to resolution'].map((title) => (
        <PageSection
          key={title}
          title={title}
          summary={
            <Stack>
              {Array.from({ length: 36 }, (_, day) => (
                <Text key={day}>Day {day + 1}</Text>
              ))}
            </Stack>
          }
        />
      ))}
    </PageLayout>
  ),
};

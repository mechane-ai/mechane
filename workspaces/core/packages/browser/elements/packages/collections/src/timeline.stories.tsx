import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, MessageSquare, Play } from 'lucide-react';
import { Row, TextLink } from '../../core/src/index.ts';
import { Timeline } from './timeline.tsx';

const meta = { title: 'Collections/Timeline', component: Timeline.Root } satisfies Meta<typeof Timeline.Root>;
export default meta;
type Story = StoryObj;

export const Activity: Story = {
  render: () => (
    <Timeline.Root label="Evaluation activity">
      <Timeline.Item icon={<Play size={16} />} title="Evaluation started" time="10:42 AM" metadata="Research team" />
      <Timeline.Item
        icon={<MessageSquare size={16} />}
        title={<TextLink href="#update">Progress update</TextLink>}
        time="10:44 AM"
        metadata={
          <Row>
            <span>Research team</span>
            <span>Edited</span>
          </Row>
        }
      >
        The longer evaluation is still running. Its notes wrap within a readable measure instead of turning into an
        oversized heading or widening the page.
      </Timeline.Item>
      <Timeline.Item
        icon={<Check size={16} />}
        title="Evaluation complete"
        time="10:48 AM"
        metadata="24 results available"
      />
    </Timeline.Root>
  ),
};

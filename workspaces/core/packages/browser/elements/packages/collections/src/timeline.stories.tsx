import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, MessageSquare, Play } from 'lucide-react';
import { Row, TextLink } from '../../core/src/index.ts';
import { Timeline } from './timeline.tsx';
import { Timestamp } from './timestamp.tsx';

const meta = {
  title: 'Collections/Timeline',
  component: Timeline.Root,
  subcomponents: { Item: Timeline.Item, Timestamp },
} satisfies Meta<typeof Timeline.Root>;

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

export const Expandable: Story = {
  render: () => (
    <Timeline.Root label="Recorded execution history">
      <Timeline.Item
        icon={<Check size={16} />}
        title="Reply"
        time={
          <Timestamp
            dateTime="2026-11-04T17:24:16.000Z"
            label="Nov 4, 5:24 PM"
            title="November 4, 2026 at 17:24:16 UTC"
          />
        }
        details="The restored source and recorded manifest agree. The integration suite remains unverified because the execution did not run it."
      >
        The restored source and recorded manifest agree.
      </Timeline.Item>
      <Timeline.Item
        icon={<Play size={16} />}
        title="Run started"
        time="5:24 PM"
        details="Execution record: restore-verification"
      />
      <Timeline.Item
        icon={<MessageSquare size={16} />}
        title="Message received"
        time="5:23 PM"
        details="Verify the restore and report which checks actually ran."
      />
    </Timeline.Root>
  ),
};

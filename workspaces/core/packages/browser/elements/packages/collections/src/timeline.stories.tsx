import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, MessageSquare, Play } from 'lucide-react';
import { Row, TextLink } from '../../core/src/index.ts';
import { Timeline } from './timeline.tsx';
import { Timestamp } from './timestamp.tsx';

const meta = {
  title: 'Collections/Timeline',
  component: Timeline.Root,
  subcomponents: { Item: Timeline.Item, Timestamp },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Timeline presents an ordered sequence of supplied events. Item separates a short event title, formatted time, optional body, and metadata. Supplying details turns a string title into a disclosure and replaces the preview with expanded content when opened. Long event text wraps in its column. Timestamp renders supplied display text and an optional exact-time tooltip accessible by pointer and keyboard. The application owns order, identity, time formatting, and links. Use DataTable when records need comparison through shared columns.',
      },
    },
  },
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

export const LongEventAtNarrowWidth: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => (
    <Timeline.Root label="Review activity">
      <Timeline.Item
        icon={<MessageSquare size={16} />}
        title="A reviewer added a longer update to the shared release checklist"
        time="November 5, 2026 at 10:44 AM UTC"
        metadata="reference0123456789abcdef0123456789abcdef0123456789abcdef"
      >
        The release remains ready for review. One source has not supplied its final result, so the latest successful
        result stays visible while the application waits for that source.
      </Timeline.Item>
    </Timeline.Root>
  ),
};

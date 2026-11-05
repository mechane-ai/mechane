import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Muted, Stack, Subheading } from '../../core/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { CollectionEnd, CollectionScroll } from './collection-scroll.tsx';

const styles = stylex.create({
  frame: { display: 'flex', flexDirection: 'column', height: 240 },
  content: { padding: spacing.lg },
});

const meta = {
  title: 'Collections/Collection scroll',
  component: CollectionScroll,
  subcomponents: { CollectionEnd },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. CollectionScroll owns one scroll region when fill is set, or follows the surrounding document otherwise. Give a filled region a contextual label for keyboard scrolling. CollectionEnd shows supplied loading, retry, or load-more states; a complete collection is silent unless the application supplies a useful summary. The application owns fetching, duplicate-request prevention, and whether more records exist. Use DataTable for comparable rows and Conversation for live message anchoring.',
      },
    },
  },
} satisfies Meta<typeof CollectionScroll>;

export default meta;
type Story = StoryObj;

const records = ['Release notes', 'Review checklist', 'Launch plan'];

function Example({ hasFailed = false }: { readonly hasFailed?: boolean }): ReactNode {
  const [hasMore, setHasMore] = useState(true);
  const visible = records.slice(0, hasMore ? 2 : records.length);

  return (
    <div {...stylex.props(styles.frame)}>
      <CollectionScroll
        shouldFill
        label="Example documents"
        endContent={
          hasMore ? (
            <CollectionEnd status={hasFailed ? 'error' : 'ready'} onLoadMore={() => setHasMore(false)} />
          ) : (
            <CollectionEnd status="complete" />
          )
        }
      >
        <div {...stylex.props(styles.content)}>
          <Stack>
            {visible.map((name) => (
              <Stack key={name} isCompact>
                <Subheading>{name}</Subheading>
                <Muted>Ready for the next review.</Muted>
              </Stack>
            ))}
          </Stack>
        </div>
      </CollectionScroll>
    </div>
  );
}

export const LoadMore: Story = { render: () => <Example /> };
export const Retry: Story = { render: () => <Example hasFailed /> };
export const Loading: Story = { render: () => <CollectionEnd status="loading" /> };
export const UsefulSummary: Story = { render: () => <CollectionEnd status="complete" message="3 documents loaded" /> };

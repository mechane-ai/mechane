import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, EmptyState, Panel, Stack, Status, TextLink } from '../../core/src/index.ts';
import { ListFooter } from './list-footer.tsx';
import { Cell, Table } from './table.tsx';

const meta = {
  title: 'Collections/Table',
  component: Table,
  subcomponents: { Cell, ListFooter },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Table renders semantic column headers and a body of native rows; Cell preserves native cell props and can show a secondary mobile label. ListFooter holds a result summary and cursor actions. The application supplies columns, row identity, formatted values, links, and server pagination. Keep secondary information available in a primary cell on narrow screens. This table does not sort, filter, or claim a complete dataset. Add table state only when a real workflow needs it; a cursor does not imply a page count.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const headers = [
  { label: 'Item', width: 50 },
  { label: 'State', width: 20 },
  { label: 'Last recorded', width: 30, secondary: true },
];

export const Recommended: Story = {
  render: () => (
    <Panel padded={false}>
      <Table label="Example items" headers={headers}>
        <tr>
          <Cell mobileLabel="Recorded today">
            <TextLink href="#release-notes">Release notes</TextLink>
          </Cell>
          <Cell>
            <Status tone="positive">Ready</Status>
          </Cell>
          <Cell secondary>Today</Cell>
        </tr>
        <tr>
          <Cell mobileLabel="Recorded yesterday">
            <TextLink href="#review-checklist">Review checklist for the complete quarterly release</TextLink>
          </Cell>
          <Cell>
            <Status tone="warning">Waiting</Status>
          </Cell>
          <Cell secondary>Yesterday</Cell>
        </tr>
      </Table>
      <ListFooter
        actions={
          <>
            <Button disabled>Previous</Button>
            <Button>Next</Button>
          </>
        }
      >
        2 items on this page
      </ListFooter>
    </Panel>
  ),
};

export const Empty: Story = {
  render: () => (
    <Panel padded={false}>
      <Table label="Example items" headers={headers}>
        <tr>
          <Cell colSpan={3}>
            <EmptyState title="No matching items">Change the filter to see more results.</EmptyState>
          </Cell>
        </tr>
      </Table>
    </Panel>
  ),
};

export const CursorStates: Story = {
  render: () => (
    <Stack>
      <ListFooter
        actions={
          <>
            <Button disabled>Previous</Button>
            <Button>Next</Button>
          </>
        }
      >
        First page
      </ListFooter>
      <ListFooter
        actions={
          <>
            <Button>Previous</Button>
            <Button disabled>Next</Button>
          </>
        }
      >
        Last recorded page
      </ListFooter>
    </Stack>
  ),
};

export const NarrowRows: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };

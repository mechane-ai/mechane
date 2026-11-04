import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { Button, Row } from '../../core/src/index.ts';
import { Toast } from './toast.tsx';

const meta = {
  title: 'Feedback/Toast',
  component: Toast.Provider,
  subcomponents: {
    Portal: Toast.Portal,
    Viewport: Toast.Viewport,
    Root: Toast.Root,
    Content: Toast.Content,
    Title: Toast.Title,
    Description: Toast.Description,
    Close: Toast.Close,
    Action: Toast.Action,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Toast reports nonessential acknowledgement outside the current region. Keep actionable errors beside their operation with Notice. Install one Provider and Viewport, then use Toast.useManager in an event handler. Toast.createManager supports an application-owned manager outside React; it must share that Provider. The Base UI manager owns timing, focus/hover pause, announcements, limits and dismissal. The application supplies text and actions. This example uses timeout zero for inspection.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ToastExample(): ReactNode {
  const manager = Toast.useManager();

  return (
    <>
      <Button
        onClick={() =>
          manager.add({
            title: 'View saved',
            description: 'The current filters are available in your saved views.',
            timeout: 0,
          })
        }
      >
        Show acknowledgement
      </Button>
      <Toast.Portal>
        <Toast.Viewport>
          {manager.toasts.map((toast) => (
            <Toast.Root key={toast.id} toast={toast}>
              <Toast.Content>
                <Toast.Title />
                <Toast.Description />
                <Row>
                  <Toast.Action render={<Button size="sm" />} onClick={() => manager.close(toast.id)}>
                    View saved item
                  </Toast.Action>
                  <Toast.Close render={<Button size="sm" variant="ghost" />}>Dismiss</Toast.Close>
                </Row>
              </Toast.Content>
            </Toast.Root>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </>
  );
}

export const Acknowledgement: Story = {
  render: () => (
    <Toast.Provider limit={3}>
      <ToastExample />
    </Toast.Provider>
  ),
};

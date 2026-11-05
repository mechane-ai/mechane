import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, Panel, Row, Stack, Text } from '../../core/src/index.ts';
import { Toaster } from './toast.tsx';

const meta = {
  title: 'Feedback/Toast',
  component: Toaster,
  parameters: {
    docs: {
      description: {
        component:
          'Toaster reports outcomes outside the current region. A failed first read uses a local Notice with Retry. A failed refresh retains usable content and reports once through a resource-owned toast with Retry. The application owns stable notification ids and dismisses them on recovery or navigation. Field validation stays beside its field. Mount one Toaster near the application root and call toast from an event handler; no provider is needed. Elements supplies token-based appearance. Sonner owns timing, stacking, swipe, announcements, and keyboard focus. Alt+T focuses notifications; Tab reaches actions and dismiss buttons. Apply the Elements theme to the document root. These synthetic examples persist and use scoped ids to separate documentation previews. Applications normally omit the toaster id.',
      },
    },
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function AcknowledgementExample(): ReactNode {
  const toasterId = useId();

  return (
    <>
      <Button
        onClick={() =>
          toast.success('View saved', {
            toasterId,
            description: 'The current filters are available in your saved views.',
            duration: Infinity,
          })
        }
      >
        Save view
      </Button>
      <Toaster id={toasterId} />
    </>
  );
}

function StatusExample(): ReactNode {
  const toasterId = useId();
  const options = { toasterId, duration: Infinity };

  return (
    <>
      <Row>
        <Button onClick={() => toast('Copied to clipboard', options)}>Neutral</Button>
        <Button onClick={() => toast.success('Changes saved', options)}>Success</Button>
        <Button onClick={() => toast.info('A new version is available', options)}>Information</Button>
        <Button onClick={() => toast.warning('The connection is slow', options)}>Warning</Button>
        <Button onClick={() => toast.error('Export failed', options)}>Error</Button>
      </Row>
      <Toaster id={toasterId} />
    </>
  );
}

function ActionExample(): ReactNode {
  const toasterId = useId();

  return (
    <>
      <Button
        onClick={() =>
          toast('Item archived', {
            toasterId,
            description: 'You can restore it from the archive at any time.',
            duration: Infinity,
            action: { label: 'Undo', onClick: () => toast.success('Item restored', { toasterId, duration: Infinity }) },
          })
        }
      >
        Archive item
      </Button>
      <Toaster id={toasterId} />
    </>
  );
}

function LoadingExample(): ReactNode {
  const toasterId = useId();
  const [isPending, setPending] = useState(false);

  return (
    <Stack>
      <Text tone="muted">Start a synthetic export, then choose its result.</Text>
      <Row>
        <Button
          onClick={() => {
            toast.loading('Exporting records', { toasterId, id: toasterId });
            setPending(true);
          }}
        >
          Start export
        </Button>
        <Button
          disabled={!isPending}
          onClick={() => {
            toast.success('Export ready', { toasterId, id: toasterId, duration: Infinity });
            setPending(false);
          }}
        >
          Complete export
        </Button>
        <Button
          disabled={!isPending}
          onClick={() => {
            toast.error('Export failed', { toasterId, id: toasterId, duration: Infinity });
            setPending(false);
          }}
        >
          Fail export
        </Button>
      </Row>
      <Toaster id={toasterId} />
    </Stack>
  );
}

function RefreshFailureExample(): ReactNode {
  const toasterId = useId();
  const notificationId = `${toasterId}-refresh`;
  const [hasFailed, setFailed] = useState(false);

  useEffect(
    () => () => {
      toast.dismiss(notificationId);
    },
    [notificationId],
  );

  function recover() {
    setFailed(false);
    toast.dismiss(notificationId);
  }

  function reportFailure() {
    setFailed(true);
    toast.error('Refresh failed', {
      toasterId,
      id: notificationId,
      description: 'The last successful result is still available.',
      duration: Infinity,
      action: { label: 'Retry', onClick: recover },
    });
  }

  return (
    <Stack>
      <Panel>
        <Text>48 records in the selected scope</Text>
      </Panel>
      <Row>
        <Button onClick={reportFailure}>Simulate refresh failure</Button>
        <Button disabled={!hasFailed} onClick={recover}>
          Resolve refresh
        </Button>
      </Row>
      <Text tone="muted">Retry completes this synthetic read. Repeated failures update the same notification.</Text>
      <Toaster id={toasterId} />
    </Stack>
  );
}

function LongMessageExample(): ReactNode {
  const toasterId = useId();
  const [isOpen, setOpened] = useState(false);

  return (
    <Stack>
      <Button
        onClick={() =>
          toast('Export ready for workspace_platform_observability_archive_20261105', {
            toasterId,
            description:
              'The selected records are available under /exports/workspace_platform_observability_archive_20261105.',
            duration: Infinity,
            action: { label: 'Open export activity and download options', onClick: () => setOpened(true) },
          })
        }
      >
        Show long notification
      </Button>
      {isOpen && (
        <Panel>
          <Text>The synthetic export options are open.</Text>
        </Panel>
      )}
      <Toaster id={toasterId} />
    </Stack>
  );
}

export const Acknowledgement: Story = { render: () => <AcknowledgementExample /> };
export const Status: Story = { render: () => <StatusExample /> };
export const Action: Story = { render: () => <ActionExample /> };
export const RefreshFailure: Story = { render: () => <RefreshFailureExample /> };
export const LongMessage: Story = { render: () => <LongMessageExample /> };

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Update a loading toast with the same id when the operation finishes. toast.promise can own this transition when a Promise represents the operation. The static loading icon follows the package’s loading treatment and remains legible with reduced motion.',
      },
    },
  },
  render: () => <LoadingExample />,
};

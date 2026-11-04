import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './actions.tsx';
import { AlertDialog } from './alert-dialog.tsx';
import { Row, Stack } from './surfaces.tsx';
import { Muted } from './text.tsx';

const meta = {
  title: 'Overlays/Alert dialog',
  component: AlertDialog.Root,
  subcomponents: {
    Trigger: AlertDialog.Trigger,
    Portal: AlertDialog.Portal,
    Backdrop: AlertDialog.Backdrop,
    Popup: AlertDialog.Popup,
    Title: AlertDialog.Title,
    Description: AlertDialog.Description,
    Close: AlertDialog.Close,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. AlertDialog requires an explicit response to a consequential action. Name the affected record in Title, explain the consequence in Description, and put the safe action first. Use ordinary Dialog for a form or informational panel. The application owns permission, pending work and the outcome. Keep a failed operation open with an inline Notice; do not close before acknowledgement. Base UI supplies alertdialog semantics and prevents outside-press dismissal.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ConfirmationExample(): ReactNode {
  const [outcome, setOutcome] = useState('No change requested');

  return (
    <Stack>
      <AlertDialog.Root>
        <AlertDialog.Trigger render={<Button tone="danger" />}>Remove sample record</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Popup>
            <AlertDialog.Title>Remove “Sample record”?</AlertDialog.Title>
            <AlertDialog.Description>
              The record will no longer appear in this example. This demonstration changes no stored data.
            </AlertDialog.Description>
            <Row>
              <AlertDialog.Close render={<Button />}>Keep record</AlertDialog.Close>
              <AlertDialog.Close
                render={<Button tone="danger" variant="solid" />}
                onClick={() => setOutcome('Removal confirmed')}
              >
                Remove record
              </AlertDialog.Close>
            </Row>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <Muted>{outcome}</Muted>
    </Stack>
  );
}

export const Confirmation: Story = { render: () => <ConfirmationExample /> };

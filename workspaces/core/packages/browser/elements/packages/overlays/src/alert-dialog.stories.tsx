import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';
import { Button, ConfirmButton, Muted, Row, Stack } from '../../core/src/index.ts';
import { createAgent } from '../../foundations/src/agent/index.ts';
import { AlertDialog } from './alert-dialog.tsx';

const meta = {
  title: 'Overlays/Alert dialog',
  component: AlertDialog.Root,
  subcomponents: {
    Trigger: AlertDialog.Trigger,
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
          'Supported. AlertDialog requires an explicit response to a consequential action. Name the affected record in Title, explain the consequence in Description, and put the safe action first. Use ordinary Dialog for a form or informational panel. The application owns permission, pending work and the outcome. Use ConfirmButton for the committing action and AlertDialog.Close for cancel. ConfirmButton requests agent approval even for neutral actions. Close the dialog after success and keep failures visible for retry. UI SDK supplies alertdialog semantics and prevents outside-press dismissal.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ConfirmationExample(): ReactNode {
  const [isOpen, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('No change requested');

  return (
    <Stack>
      <AlertDialog.Root open={isOpen} onOpenChange={setOpen}>
        <AlertDialog.Trigger render={<Button />}>Publish sample record</AlertDialog.Trigger>
        <AlertDialog.Backdrop />
        <AlertDialog.Popup>
          <AlertDialog.Title>Publish “Sample record”?</AlertDialog.Title>
          <AlertDialog.Description>
            Publishing makes the record visible to the team. This example changes local state.
          </AlertDialog.Description>
          <Row>
            <AlertDialog.Close render={<Button />}>Keep draft</AlertDialog.Close>
            <ConfirmButton
              confirmation="Publish Sample record?"
              onClick={() => {
                setOutcome('Publication confirmed');
                setOpen(false);
              }}
            >
              Publish record
            </ConfirmButton>
          </Row>
        </AlertDialog.Popup>
      </AlertDialog.Root>
      <Muted>{outcome}</Muted>
    </Stack>
  );
}

export const Confirmation: Story = {
  tags: ['interaction'],
  render: () => <ConfirmationExample />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Publish sample record' }));

    const dialog = await within(canvasElement.ownerDocument.body).findByRole('alertdialog');
    const agent = createAgent();
    const popup = agent.snapshot().find((entry) => entry.component === 'alert-dialog' && entry['open'] === true);

    if (popup === undefined) {
      throw new Error('The open confirmation dialog is missing from the agent snapshot.');
    }

    const button = within(dialog).getByRole('button', { name: 'Publish record' });
    const attempt = await agent.act({ steps: [{ ref: popup.ref, action: 'press', args: [button.textContent] }] });

    await expect(attempt.ok).toBe(false);
    await expect(attempt.error?.message).toContain('Publish Sample record?');
    await expect(canvas.getByText('No change requested')).toBeInTheDocument();
    await userEvent.click(button);
    await expect(canvas.getByText('Publication confirmed')).toBeVisible();
  },
};

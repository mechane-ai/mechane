import type { Meta, StoryObj } from '@storybook/react-vite';
import { Archive } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Muted, Row, Stack } from '../../core/src/index.ts';
import { Dialog } from './dialog.tsx';
import { Tooltip } from './tooltip.tsx';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog.Root,
  subcomponents: {
    Trigger: Dialog.Trigger,
    Portal: Dialog.Portal,
    Backdrop: Dialog.Backdrop,
    Popup: Dialog.Popup,
    Title: Dialog.Title,
    Description: Dialog.Description,
    Close: Dialog.Close,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Dialog.Root owns the open state. Trigger opens a Popup through Portal and Backdrop; Title and Description give the dialog its accessible name and context. Close composes the dismissal control. Use a dialog for a focused decision, and an inline Notice for a recoverable page error. The application supplies the decision, action, permissions, and pending state. Keep the trigger mounted so dismissal can restore focus. Use render to compose triggers instead of nesting buttons. Frequent compositions such as CommandPalette set motion="none" on Popup and Backdrop; ordinary dialogs use the standard motion and respect reduced motion.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

type ArchiveDialogProps = { readonly isComposed?: boolean; readonly shouldRenderFromState?: boolean };

function ArchiveDialog({ isComposed = false, shouldRenderFromState = false }: ArchiveDialogProps): ReactNode {
  const [openCount, setOpenCount] = useState(0);

  const trigger = (
    <Dialog.Trigger
      onClick={() => setOpenCount(openCount + 1)}
      style={{ minWidth: 160 }}
      render={
        shouldRenderFromState ? (
          (props, state) => <Button {...props} variant={state.open ? 'solid' : 'outline'} />
        ) : (
          <Button />
        )
      }
    >
      <Archive size={16} aria-hidden />
      Archive item
    </Dialog.Trigger>
  );

  return (
    <Stack isCompact>
      <Tooltip.Provider>
        <Dialog.Root>
          {isComposed ? (
            <Tooltip.Root>
              <Tooltip.Trigger render={trigger} />
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={8}>
                  <Tooltip.Popup>Review before archiving</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : (
            trigger
          )}
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <Stack>
                <Stack isCompact>
                  <Dialog.Title>Archive release notes?</Dialog.Title>
                  <Dialog.Description>
                    The saved notes remain available, but this item will no longer appear in the active collection.
                  </Dialog.Description>
                </Stack>
                <Row>
                  <Dialog.Close render={<Button tone="danger" variant="solid" />}>Archive item</Dialog.Close>
                  <Dialog.Close render={<Button />}>Keep item</Dialog.Close>
                </Row>
              </Stack>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Tooltip.Provider>
      <Muted>Trigger activations: {openCount}. This example makes no external changes.</Muted>
    </Stack>
  );
}

export const Recommended: Story = { render: () => <ArchiveDialog /> };

export const ComposedTooltipTrigger: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tab to the composed trigger, activate it, and dismiss the dialog with Escape. Concrete style objects and class strings compose through the nested render elements; the click handler remains active and focus returns to the same trigger. State callbacks for className or style belong on the outermost trigger, not an inner render element.',
      },
    },
  },
  render: () => <ArchiveDialog isComposed />,
};

export const RenderFromState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Use a render function for state-dependent composition. Spread its supplied props to preserve the merged refs, handlers, classes, and styles, then choose a named Button variant from Dialog state. This trigger becomes solid while its dialog is open. ClassName and style callbacks on a nested React render element are not supported by the pinned Base UI release.',
      },
    },
  },
  render: () => <ArchiveDialog isComposed shouldRenderFromState />,
};

export const NarrowDialog: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <ArchiveDialog />,
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { Button, Stack, Text } from '../../../core/src/index.ts';
import { CommandPalette, ShortcutHint, useCommandShortcuts } from './command.tsx';
import type { CommandAction } from './command.tsx';

function CommandsExample() {
  const scope = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState('Choose an action.');

  const commands: ReadonlyArray<CommandAction> = [
    {
      id: 'create',
      label: 'Create a project for the next release review',
      description: 'Start a workspace with the documents and collaborators needed for the review.',
      onSelect: () => setLastAction('Create project requested.'),
    },
    { id: 'view', label: 'Open recent activity', onSelect: () => setLastAction('Recent activity requested.') },
    {
      id: 'archive',
      label: 'Archive project',
      description: 'Unavailable until a project is selected',
      disabled: true,
      onSelect: () => setLastAction('Archive requested.'),
    },
  ];

  const opener = {
    id: 'palette',
    label: 'Open commands',
    shortcut: { key: 'K', mod: true },
    onSelect: () => setOpen(true),
  };

  useCommandShortcuts({ target: scope, enabled: !open, commands: [opener] });

  return (
    <div ref={scope}>
      <Stack>
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          title="Commands"
          commands={commands}
          trigger={<Button>Open commands</Button>}
        />
        <Text>{lastAction}</Text>
        <Text>
          Focus the button, then use <ShortcutHint shortcut={opener.shortcut} />. Typing fields and modal content keep
          their own shortcuts.
        </Text>
      </Stack>
    </div>
  );
}

const meta = {
  title: 'Navigation/Commands',
  component: CommandPalette,
  subcomponents: { ShortcutHint },
  parameters: {
    docs: {
      description: {
        component:
          'Application-owned actions power both the command palette and scoped shortcuts. Base UI owns the dialog and search list. TanStack Hotkeys owns registration cleanup and chord matching. Choose CommandPalette for a searchable action list and a Button for a single visible action. ShortcutHint formats the same shortcut definition used by useCommandShortcuts; it does not register a binding. Always supply a scope and explicit eligibility; shortcut activation never bypasses the action’s disabled state.',
      },
    },
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj;
export const Palette: Story = { render: () => <CommandsExample /> };

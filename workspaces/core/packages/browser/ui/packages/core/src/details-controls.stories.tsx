import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Avatar, SettingsRow, Timestamp } from './details-controls.tsx';
import { Input } from './forms.tsx';
import { Row, Stack } from './surfaces.tsx';
import { Text } from './text.tsx';

const meta = {
  title: 'Data display/Details',
  component: SettingsRow,
  subcomponents: { Avatar, Timestamp },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. SettingsRow pairs a label and explanation with the control identified by controlId. The application owns drafts, validation and saving; use Field for a compact form rather than a settings row. Avatar displays supplied initials or an image with one accessible name, never derived identity. Timestamp renders a supplied ISO dateTime and display label. The caller formats that label with its explicit locale and time zone, so SSR and client output agree.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function SettingsExample(): ReactNode {
  const [name, setName] = useState('Sample project');

  return (
    <Stack>
      <SettingsRow label="Display name" description="The name shown in this example." controlId="example-project-name">
        <Input id="example-project-name" value={name} onValueChange={setName} />
      </SettingsRow>
      <Row>
        <Avatar label="Sample contributor" fallback="SC" size="sm" />
        <Avatar label="Sample contributor" fallback="SC" />
        <Avatar label="Sample contributor" fallback="SC" size="lg" />
        <Text>Sample contributor</Text>
        <Timestamp dateTime="2026-11-03T09:00:00Z" label="Nov 3, 2026, 09:00 UTC" />
      </Row>
    </Stack>
  );
}

export const LabelAndValue: Story = { render: () => <SettingsExample /> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../../core/src/index.ts';
import { CommandActivity } from './command-activity.tsx';
import { CommandDetails } from './command-details.tsx';
import { ReplyIndicator } from './reply-indicator.tsx';

const meta = {
  title: 'AI/Command activity',
  component: CommandActivity,
  parameters: {
    docs: {
      description: {
        component:
          'Recorded Bash input and output. Applications supply execution state, source text and omission notices. The disclosure owns only inspection; overall reply progress belongs below the activity.',
      },
    },
  },
  args: {
    command: 'coworld submissions --help',
    output: 'Usage: coworld submissions [OPTIONS]\n\nList league submissions.',
    status: 'complete',
  },
} satisfies Meta<typeof CommandActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {};

export const Running: Story = {
  render: (args) => (
    <Stack isCompact>
      <CommandActivity {...args} status="running" output="" />
      <ReplyIndicator label="Working…" delayMs={0} />
    </Stack>
  ),
};

export const Failed: Story = { args: { status: 'failed', output: 'error: no such file or directory' } };
export const Stopped: Story = { args: { status: 'stopped', output: '' } };

export const Multiline: Story = {
  args: {
    command: 'python - <<\'PY\'\nfrom pathlib import Path\nprint(len(list(Path("src").rglob("*.py"))))\nPY',
    output: '167',
  },
};

export const MissingInput: Story = { args: { command: undefined } };

export const PlainOutput: Story = {
  render: () => (
    <CommandDetails
      command="python scripts/inspect.py"
      output={"dict_keys(['entries', 'next_cursor'])\nentries list 167\nnext_cursor NoneType"}
    />
  ),
};

export const JsonOutput: Story = {
  render: () => (
    <CommandDetails
      command="coworld submissions --json"
      output={'{\n  "entries": [],\n  "next_cursor": null\n}'}
      outputLanguage="json"
    />
  ),
};

export const ShortenedOutput: Story = {
  render: () => (
    <CommandDetails
      command="cat large.log"
      output={'First received line\n'.repeat(12)}
      outputNotice="12,000 characters omitted from this preview."
    />
  ),
};

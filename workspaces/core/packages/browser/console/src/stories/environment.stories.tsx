import { Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import {
  EnvironmentPlaceholder,
  EnvironmentProcesses,
  EnvironmentProcessOutput,
  EnvironmentProcessOutputPlaceholder,
} from '@mechane/console-views';
import { ProcessObservation } from '@mechane/protocol';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Schema } from 'effect';

const processes = Schema.decodeUnknownSync(Schema.Array(ProcessObservation))([
  {
    handle: { machine_id: '1426c052-dbbc-4e2c-afb1-8d3386875f4b', process_id: '2540a6a4-6b0c-49cd-9534-920d75c4138d' },
    state: { _tag: 'Running' },
    output: { text: 'Development server listening on http://localhost:3000\nGET / 200\n', omitted_bytes: 0 },
  },
  {
    handle: { machine_id: '1426c052-dbbc-4e2c-afb1-8d3386875f4b', process_id: '23846c29-9979-4f75-9f03-1df90c825a35' },
    state: { _tag: 'Lost' },
    output: { text: 'Previous environment output\n', omitted_bytes: 1024 },
  },
]);

const meta = {
  title: 'Screens/Environment',
  component: EnvironmentProcesses,
  subcomponents: { EnvironmentPlaceholder, EnvironmentProcessOutput, EnvironmentProcessOutputPlaceholder },
  tags: ['!supported'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Managed processes keep their exact machine identity. The application supplies recorded status, bounded output, stop progress and failures. A Running process does not establish application readiness. Stopped machines never imply a restarted process. Expanded logs retain reader control during refresh.',
      },
    },
  },
  args: {
    processes,
    stopping: new Set(),
    failure: undefined,
    onStop: () => undefined,
    renderDetails: (summary) => {
      const process = processes.find((candidate) => candidate.handle.processId === summary.handle.processId);

      return process === undefined ? null : <EnvironmentProcessOutput process={process} />;
    },
  },
  decorators: [
    (Story) => (
      <Workbench>
        <WorkbenchScroll label="Environment">
          <Story />
        </WorkbenchScroll>
      </Workbench>
    ),
  ],
} satisfies Meta<typeof EnvironmentProcesses>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Processes: Story = {};
export const Empty: Story = { args: { processes: [] } };

export const StopFailed: Story = {
  args: { failure: 'The machine did not confirm that the process stopped. Refresh its status before retrying.' },
};

export const Loading: Story = { render: () => <EnvironmentPlaceholder /> };

export const OutputLoading: Story = { render: () => <EnvironmentProcessOutputPlaceholder /> };

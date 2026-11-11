import { Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import {
  EnvironmentDurability,
  EnvironmentPlaceholder,
  EnvironmentProcesses,
  EnvironmentProcessOutput,
  EnvironmentProcessOutputPlaceholder,
} from '@mechane/console-views';
import { ProcessObservation, SandboxReport } from '@mechane/protocol';
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

const savedFiles = {
  provider: 'fixture',
  sandbox_id: null,
  status: 'running',
  image: null,
  desired_image: 'fixture',
  operation_id: null,
  action: null,
  phase: 'idle',
  last_error: null,
  environment: {
    committed_generation: '6ff27372-872a-40f1-98fa-3657a2a35d21',
    durability: {
      activity_sequence: 7,
      captured_sequence: 7,
      captured_at: '2026-11-11T12:00:00Z',
      next_checkpoint_at: '2026-11-11T12:00:30Z',
      last_error: null,
    },
    checkpoint: null,
    recovery: null,
    stop: null,
  },
};

const savedReport = Schema.decodeUnknownSync(SandboxReport)(savedFiles);

const uploadingReport = Schema.decodeUnknownSync(SandboxReport)({
  ...savedFiles,
  environment: {
    ...savedFiles.environment,
    checkpoint: {
      generation: '47e6c1b7-0edf-4e97-b6f2-5d9a77c64455',
      machine_id: '1426c052-dbbc-4e2c-afb1-8d3386875f4b',
      is_automatic: true,
      execution_id: null,
      operation_id: '3dc202bf-27a1-457d-8263-1ab2a586a1ca',
      started_at: '2026-11-11T12:00:30Z',
      uploaded_parts: 3,
      total_parts: 5,
    },
  },
});

const failedReport = Schema.decodeUnknownSync(SandboxReport)({
  ...savedFiles,
  environment: {
    ...savedFiles.environment,
    durability: { ...savedFiles.environment.durability, last_error: 'The file upload could not be completed.' },
    recovery: {
      generation: '47e6c1b7-0edf-4e97-b6f2-5d9a77c64455',
      machine_id: '1426c052-dbbc-4e2c-afb1-8d3386875f4b',
      reason: 'Live files were retained for recovery. The previous saved checkpoint is still available.',
    },
  },
});

const meta = {
  title: 'Screens/Environment',
  component: EnvironmentProcesses,
  subcomponents: {
    EnvironmentDurability,
    EnvironmentPlaceholder,
    EnvironmentProcessOutput,
    EnvironmentProcessOutputPlaceholder,
  },
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

export const SavedFiles: Story = { render: () => <EnvironmentDurability report={savedReport} /> };
export const SavingFiles: Story = { render: () => <EnvironmentDurability report={uploadingReport} /> };
export const SaveFailed: Story = { render: () => <EnvironmentDurability report={failedReport} /> };

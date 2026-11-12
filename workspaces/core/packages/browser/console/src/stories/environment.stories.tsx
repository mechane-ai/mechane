import { Stack } from '@mechane-ai/elements';
import { Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import {
  EnvironmentDurability,
  EnvironmentPlaceholder,
  EnvironmentProcesses,
  EnvironmentProcessOutput,
  EnvironmentProcessOutputPlaceholder,
  EnvironmentStartup,
} from '@mechane/console-views';
import { ProcessObservation, SandboxReport } from '@mechane/protocol';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Option, Schema } from 'effect';
import type { ReactNode } from 'react';

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
    processes: [],
    processes_observed_at: null,
    last_startup_failure: null,
    startup: null,
    execution: null,
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

const machineId = '1426c052-dbbc-4e2c-afb1-8d3386875f4b';

const failure = {
  machine_id: machineId,
  code: 'tool_preparation_failed',
  phase: 'bootstrap',
  at: '2026-11-11T12:00:08Z',
};

const preparing = {
  machine_id: machineId,
  deadline_at: '2026-11-11T12:09:30Z',
  last_failure: null,
  progress: {
    phase: 'bootstrap',
    started_at: '2026-11-11T12:00:00Z',
    updated_at: '2026-11-11T12:00:07Z',
    failure: null,
    steps: [
      { phase: 'container', tool: null, started_at: '2026-11-11T12:00:00Z', duration: 1200 },
      { phase: 'bootstrap', tool: null, started_at: '2026-11-11T12:00:02Z', duration: null },
    ],
  },
  guest: {
    bootstrap: {
      phase: 'check_tool',
      started_at: '2026-11-11T12:00:02Z',
      updated_at: '2026-11-11T12:00:07Z',
      failure: null,
      steps: [
        { phase: 'download', tool: 'gh', started_at: '2026-11-11T12:00:02Z', duration: 3020 },
        { phase: 'verify', tool: 'gh', started_at: '2026-11-11T12:00:05Z', duration: 20 },
        { phase: 'extract', tool: 'gh', started_at: '2026-11-11T12:00:06Z', duration: 300 },
        { phase: 'check_tool', tool: 'gh', started_at: '2026-11-11T12:00:07Z', duration: null },
      ],
    },
    restoration: null,
  },
  restoration: null,
};

const preparingComputer = Schema.decodeUnknownSync(SandboxReport)({
  ...savedFiles,
  status: 'starting',
  sandbox_id: machineId,
  environment: { ...savedFiles.environment, startup: preparing },
});

const failedComputer = Schema.decodeUnknownSync(SandboxReport)({
  ...savedFiles,
  status: 'empty',
  environment: {
    ...savedFiles.environment,
    last_startup_failure: failure,
    startup: {
      ...preparing,
      last_failure: failure,
      progress: { ...preparing.progress, updated_at: failure.at, failure: failure.code },
    },
  },
});

const readyStartup = {
  ...preparing,
  progress: {
    ...preparing.progress,
    phase: 'ready',
    updated_at: '2026-11-11T12:00:09Z',
    steps: [
      ...preparing.progress.steps,
      { phase: 'ready', tool: null, started_at: '2026-11-11T12:00:09Z', duration: null },
    ],
  },
  guest: {
    ...preparing.guest,
    bootstrap: {
      ...preparing.guest.bootstrap,
      phase: 'guest_ready',
      updated_at: '2026-11-11T12:00:08Z',
      steps: [
        ...preparing.guest.bootstrap.steps,
        { phase: 'guest_ready', tool: null, started_at: '2026-11-11T12:00:08Z', duration: null },
      ],
    },
  },
};

const readyComputer = Schema.decodeUnknownSync(SandboxReport)({
  ...savedFiles,
  status: 'ready',
  sandbox_id: machineId,
  environment: { ...savedFiles.environment, startup: readyStartup, last_startup_failure: failure },
});

const sleepingComputer = Schema.decodeUnknownSync(SandboxReport)({
  ...savedFiles,
  status: 'sleeping',
  environment: { ...savedFiles.environment, startup: readyStartup },
});

const meta = {
  title: 'Screens/Environment',
  component: EnvironmentProcesses,
  subcomponents: {
    EnvironmentDurability,
    EnvironmentStartup,
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
    processes: Option.some(processes),
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
export const Empty: Story = { args: { processes: Option.some([]) } };
export const ProcessesUnavailable: Story = { args: { processes: Option.none() } };

export const StopFailed: Story = {
  args: { failure: 'The machine did not confirm that the process stopped. Refresh its status before retrying.' },
};

export const Loading: Story = { render: () => <EnvironmentPlaceholder /> };

export const OutputLoading: Story = { render: () => <EnvironmentProcessOutputPlaceholder /> };

export const SavedFiles: Story = { render: () => <EnvironmentDurability report={savedReport} /> };
export const SavingFiles: Story = { render: () => <EnvironmentDurability report={uploadingReport} /> };
export const SaveFailed: Story = { render: () => <EnvironmentDurability report={failedReport} /> };

function ComputerExample({ report }: { readonly report: SandboxReport }): ReactNode {
  return (
    <Stack>
      <EnvironmentStartup report={report} />
      <EnvironmentDurability report={report} />
      <EnvironmentProcesses
        processes={report.environment.processes}
        stopping={new Set()}
        failure={undefined}
        onStop={() => undefined}
        renderDetails={() => null}
      />
    </Stack>
  );
}

export const PreparingComputer: Story = { render: () => <ComputerExample report={preparingComputer} /> };
export const PreparationFailed: Story = { render: () => <ComputerExample report={failedComputer} /> };
export const ReadyComputer: Story = { render: () => <ComputerExample report={readyComputer} /> };
export const SleepingComputer: Story = { render: () => <ComputerExample report={sleepingComputer} /> };

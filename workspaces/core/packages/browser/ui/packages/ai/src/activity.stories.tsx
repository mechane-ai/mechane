import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CodeBlock } from '../../content/src/code/index.ts';
import { JsonViewer, LogViewer, Markdown, StackTrace } from '../../content/src/index.ts';
import { Badge, Button, Collapsible, Divider, Muted, Row, Stack, Text, Trace } from '../../core/src/index.ts';
import { Approval } from './approval.tsx';

const meta = {
  title: 'AI/Activity recipes',
  component: Approval,
  parameters: {
    docs: {
      description: {
        component:
          'Agent activity uses the same Trace, disclosure and content parts as ordinary application activity. Every step, status, summary and output here is supplied synthetic evidence. Applications own execution, request identity, authorization and acknowledgement. Approval presents a specific identified decision; use AlertDialog for a generic confirmation. Approval reports intent and stays pending until the application supplies an acknowledged result. Recipes do not reconstruct hidden reasoning or guess tool outcomes.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ApprovalExample(): ReactNode {
  const [decision, setDecision] = useState<'approve' | 'deny'>();
  const [outcome, setOutcome] = useState<'approved' | 'denied'>();

  return (
    <Stack>
      {outcome === undefined ? (
        <Approval
          requestId="example-write-report"
          status="pending"
          title="Write comparison.md?"
          description="This request would write the supplied report to the selected workspace."
          onApprove={() => setDecision('approve')}
          onDeny={() => setDecision('deny')}
          busy={decision}
        >
          <CodeBlock
            filename="comparison.md"
            language="markdown"
            code="# Evaluation comparison\n\nThe candidate improved the median score."
          />
        </Approval>
      ) : (
        <Approval
          requestId="example-write-report"
          status={outcome}
          statusLabel={outcome === 'approved' ? 'Approval acknowledged' : 'Denial acknowledged'}
          title="Write comparison.md?"
        />
      )}
      {decision !== undefined && outcome === undefined && (
        <Button onClick={() => setOutcome(decision === 'approve' ? 'approved' : 'denied')}>
          Simulate acknowledged decision
        </Button>
      )}
      <Muted>
        Clicking a decision only marks it pending. The application must receive an acknowledgement before showing an
        outcome.
      </Muted>
    </Stack>
  );
}

function CheckpointExample(): ReactNode {
  const [intent, setIntent] = useState('No action requested.');

  return (
    <Stack>
      <Divider />
      <Row>
        <Badge>Checkpoint</Badge>
        <Text>Comparison draft · revision 3</Text>
        <Button onClick={() => setIntent('Restore requested for revision 3.')}>Restore</Button>
        <Button onClick={() => setIntent('Fork requested from revision 3.')}>Fork</Button>
      </Row>
      <Muted>{intent} This recipe reports intent; it does not alter stored history.</Muted>
      <Divider />
    </Stack>
  );
}

export const Tool: Story = {
  render: () => (
    <Trace.Root label="Recorded tool activity">
      <Trace.Item
        id="read-cases"
        label="Read evaluation cases"
        status="complete"
        statusLabel="Completed"
        description="24 supplied cases were read."
        detail={
          <Stack>
            <JsonViewer value={{ path: 'evaluation/cases.json', limit: 24 }} label="Recorded input" />
            <CodeBlock
              filename="result.json"
              language="json"
              code={'{\n  "cases": 24,\n  "missingMeasurements": 2\n}'}
            />
          </Stack>
        }
      />
      <Trace.Item
        id="compare-cases"
        label="Compare measurements"
        status="failed"
        statusLabel="Failed"
        description="Two cases have no candidate measurement."
        detail={
          <LogViewer
            label="Recorded comparison output"
            output="Comparison stopped: missing candidate values for cases case-07 and case-19.\nNo results were written."
          />
        }
      />
    </Trace.Root>
  ),
};

export const SuppliedSummary: Story = {
  render: () => (
    <Stack>
      <Collapsible.Root>
        <Collapsible.Trigger>Supplied explanation</Collapsible.Trigger>
        <Collapsible.Panel>
          <Markdown>
            {
              'The comparison uses matched case IDs. Missing measurements are listed separately, so they do not lower the candidate average.'
            }
          </Markdown>
        </Collapsible.Panel>
      </Collapsible.Root>
      <Trace.Root label="Recorded analysis steps">
        <Trace.Item
          id="match"
          label="Matched evaluation cases"
          status="complete"
          statusLabel="Complete"
          description="22 cases have measurements in both runs."
        />
        <Trace.Item
          id="gaps"
          label="Identified evidence gaps"
          status="complete"
          statusLabel="Complete"
          description="Two candidate measurements are unavailable."
        />
        <Trace.Item id="summary" label="Summarized the matched comparison" status="complete" statusLabel="Complete" />
      </Trace.Root>
      <Muted>
        This is a supplied summary and recorded step list. It makes no claim about a model’s private reasoning.
      </Muted>
    </Stack>
  ),
};

export const PlanAndQueue: Story = {
  render: () => (
    <Stack>
      <Trace.Root label="Planned work">
        <Trace.Item id="plan-compare" label="Compare matched cases" status="complete" statusLabel="Done" />
        <Trace.Item id="plan-review" label="Review missing measurements" status="running" statusLabel="In progress">
          <Trace.Group label="Recorded review tasks">
            <Trace.Item
              id="task-case-07"
              label="Inspect case-07"
              status="complete"
              statusLabel="Done"
              description="The candidate measurement was not recorded."
            />
            <Trace.Item id="task-case-19" label="Inspect case-19" status="running" statusLabel="Running" />
          </Trace.Group>
        </Trace.Item>
        <Trace.Item id="plan-publish" label="Write the comparison" status="pending" statusLabel="Queued after review" />
      </Trace.Root>
      <Trace.Root label="Queued follow-ups">
        <Trace.Item
          id="queue-repeat"
          label="Repeat the two missing cases"
          status="pending"
          statusLabel="Waiting for approval"
        />
        <Trace.Item
          id="queue-export"
          label="Export the result table"
          status="skipped"
          statusLabel="Cancelled by the application"
        />
      </Trace.Root>
    </Stack>
  ),
};

export const Subagent: Story = {
  render: () => (
    <Trace.Root label="Review run">
      <Trace.Item
        id="reviewer"
        label="Evaluation reviewer"
        status="complete"
        statusLabel="Complete"
        description="A supplied child run reviewed the missing cases."
        detail={
          <Markdown>
            {'The report should explicitly exclude the two missing candidate measurements from the matched comparison.'}
          </Markdown>
        }
      >
        <Trace.Group label="Reviewer activity">
          <Trace.Item id="reviewer-read" label="Read the case manifest" status="complete" statusLabel="Complete" />
          <Trace.Item
            id="reviewer-compare"
            label="Checked measurement coverage"
            status="complete"
            statusLabel="Complete"
          />
        </Trace.Group>
      </Trace.Item>
    </Trace.Root>
  ),
};

export const Confirmation: Story = { render: () => <ApprovalExample /> };
export const Checkpoint: Story = { render: () => <CheckpointExample /> };

export const RecordedOutput: Story = {
  render: () => (
    <Stack>
      <Trace.Root label="Recorded command">
        <Trace.Item
          id="command"
          label="validate evaluation/cases.json"
          status="failed"
          statusLabel="Exited with status 1"
          detail={
            <LogViewer
              label="Recorded terminal output"
              output={
                '$ validate evaluation/cases.json\nRead 24 cases\nMissing candidate values: case-07, case-19\nValidation failed.'
              }
            />
          }
        />
      </Trace.Root>
      <StackTrace
        message="MissingMeasurement: candidate value is unavailable"
        frames={[
          {
            id: 'compare-frame',
            name: 'compareCase',
            file: 'src/comparison.ts',
            line: 18,
            href: '/examples/src/comparison.ts#L18',
            code: 'return compare(baseline, candidate);',
            language: 'typescript',
          },
          { id: 'run-frame', name: 'runComparison', file: 'src/run.ts', line: 42, href: '/examples/src/run.ts#L42' },
        ]}
      />
    </Stack>
  ),
};

export const TestResults: Story = {
  render: () => (
    <Stack>
      <Row>
        <Badge tone="positive">2 passed</Badge>
        <Badge tone="negative">1 failed</Badge>
        <Muted>Three supplied checks</Muted>
      </Row>
      <Trace.Root label="Recorded check results">
        <Trace.Item id="case-ids" label="Case identifiers are unique" status="complete" statusLabel="Passed" />
        <Trace.Item id="baseline" label="Baseline measurements are complete" status="complete" statusLabel="Passed" />
        <Trace.Item
          id="candidate"
          label="Candidate measurements are complete"
          status="failed"
          statusLabel="Failed"
          detail={
            <CodeBlock
              language="text"
              code="Expected 24 candidate measurements.\nReceived 22.\nMissing: case-07, case-19."
            />
          }
        />
      </Trace.Root>
    </Stack>
  ),
};

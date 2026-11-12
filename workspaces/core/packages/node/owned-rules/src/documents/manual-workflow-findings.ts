import type { Finding, TextFile } from '@mechane/checks-kernel';
import { CONTRACTS } from '@mechane/rules';
import { Record, Result, Schema } from 'effect';
import { parse } from 'yaml';

const WorkflowEvent = { Dispatch: 'workflow_dispatch' } as const;

const EventList = Schema.Array(Schema.String);

const isEventList = Schema.is(EventList);

const Workflow = Schema.Struct({
  on: Schema.Union([Schema.String, EventList, Schema.Record(Schema.String, Schema.Unknown)]),
});

/** Release construction must be an explicit operator choice, regardless of YAML event syntax. */
export function manualWorkflowFindings({ path, text }: TextFile): ReadonlyArray<Finding> {
  const manualWorkflows: ReadonlyArray<string> = CONTRACTS['ci-check-trust'].values.manualWorkflows;

  if (!manualWorkflows.includes(path)) {
    return [];
  }

  const parsed = Result.try({ try: (): unknown => parse(text), catch: () => 'Invalid workflow YAML' });
  const decodeWorkflow = Schema.decodeUnknownResult(Workflow);

  const decoded = Result.flatMap(parsed, decodeWorkflow);

  if (Result.isSuccess(decoded)) {
    const events = workflowEvents({ value: decoded.success.on });

    if (events.length === 1 && events[0] === WorkflowEvent.Dispatch) {
      return [];
    }
  }

  return [
    {
      check: 'workflows',
      location: path,
      message: 'Run release candidate builds only through workflow_dispatch, such as `on: workflow_dispatch`',
    },
  ];
}

type WorkflowEventsInput = { readonly value: typeof Workflow.Type.on };

function workflowEvents({ value }: WorkflowEventsInput): ReadonlyArray<string> {
  if (typeof value === 'string') {
    return [value];
  }

  if (isEventList(value)) {
    return value;
  }

  return Record.keys(value);
}

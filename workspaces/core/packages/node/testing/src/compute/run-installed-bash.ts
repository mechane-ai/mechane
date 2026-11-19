import { randomUUID } from 'node:crypto';
import { requireFixtures } from '../fixtures.ts';
import type { ManagedContext } from '../managed-context.ts';
import { waitFor } from '../wait-for.ts';

const SHELL_TIMEOUT_MS = 90_000;

type BashInput = { readonly command: string; readonly timeoutMs?: number };

export async function runInstalledBash(context: ManagedContext, input: BashInput): Promise<string> {
  const { stack, client, session } = context;
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const done = `Observed ${marker}`;

  model.configure({
    marker,
    replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command: input.command } }] }, { text: done }],
  });

  const response = await client.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
  });

  const inputId = response.data?.[0]?.id;

  if (inputId === undefined) {
    throw new Error('The session did not return an input receipt');
  }

  const history = await waitFor({
    name: 'the installed shell result',
    timeoutMs: input.timeoutMs ?? SHELL_TIMEOUT_MS,
    read: async () => {
      const events = [];

      for await (const event of client.beta.sessions.events.list(session.id)) {
        events.push(event);
      }

      return events;
    },
    accept: (events) =>
      events.some(
        (event) =>
          event.type === 'agent.message' && event.content.some((part) => part.type === 'text' && part.text === done),
      ),
  });

  const start = history.findIndex((event) => event.id === inputId);

  if (start === -1) {
    throw new Error('The accepted shell input disappeared from history');
  }

  const use = history
    .slice(start + 1)
    .find(
      (event) => event.type === 'agent.tool_use' && event.name === 'bash' && event.input['command'] === input.command,
    );

  const result = history.find((event) => event.type === 'user.tool_result' && event.tool_use_id === use?.id);

  if (result?.type !== 'user.tool_result') {
    throw new Error('The shell completed without a linked session result');
  }

  const text = (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  if (result.is_error === true) {
    throw new Error(`Installed shell command failed (tool use ${result.tool_use_id})`);
  }

  return text;
}

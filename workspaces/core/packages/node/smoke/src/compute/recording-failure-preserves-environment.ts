import {
  createMechContext,
  deleteSandbox,
  readModelToolResult,
  requireFixtures,
  runBash,
  sendNotification,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext, ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const ProcessResult = Schema.Struct({ status: Schema.String, processId: Schema.String, machineId: Schema.String });

const BrowserResult = Schema.Struct({
  progress: Schema.Struct({
    _tag: Schema.String,
    response: Schema.optionalKey(Schema.Struct({ result: Schema.Unknown })),
  }),
});

const TabResult = Schema.Struct({ _tag: Schema.Literal('Tab'), tab: Schema.Struct({ tabId: Schema.String }) });
const RecordingResult = Schema.Struct({ _tag: Schema.Literal('Recording'), recordingId: Schema.String });
const VideoResult = Schema.Struct({ _tag: Schema.Literal('Video') });

export async function recordingFailurePreservesEnvironment({ stack }: ScenarioInput): Promise<void> {
  const input = await createMechContext({ stack, name: `recording-failure-${randomUUID()}` });
  const sentinel = `home-${randomUUID()}`;

  try {
    const setup = await runBash({
      ...input,
      command: `printf '%s' '${sentinel}' > recording-home; bin=$(printf '%s' "$PATH" | cut -d: -f2); printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox "$@"\n' > "$bin/chromium"; chmod +x "$bin/chromium"`,
    });

    assert.equal(setup.receipt.status, 'completed');

    const process = Schema.decodeUnknownSync(ProcessResult)(
      await invoke(input, 'start_process', {
        command: `node -e 'require("http").createServer((q,s)=>s.end("recording")).listen(43137,"127.0.0.1")'`,
      }),
    );

    assert.equal(process.status, 'running');

    const ready = await runBash({
      ...input,
      command: 'for i in $(seq 1 100); do curl -fsS http://127.0.0.1:43137 && exit 0; sleep .1; done; exit 1',
    });

    assert.equal(ready.result.output, 'recording');

    const opened = Schema.decodeUnknownSync(BrowserResult)(
      await invoke(input, 'browser_open', { url: 'http://127.0.0.1:43137' }),
    );

    assert.equal(opened.progress._tag, 'Ready');

    const tab = Schema.decodeUnknownSync(TabResult)(opened.progress.response?.result);

    const healthy = Schema.decodeUnknownSync(BrowserResult)(
      await invoke(input, 'browser_record_start', { tabId: tab.tab.tabId }),
    );

    const healthyRecording = Schema.decodeUnknownSync(RecordingResult)(healthy.progress.response?.result);

    await runBash({ ...input, command: 'sleep 2' });

    const video = Schema.decodeUnknownSync(BrowserResult)(
      await invoke(input, 'browser_record_stop', { tabId: tab.tab.tabId, recordingId: healthyRecording.recordingId }),
    );

    assert.equal(video.progress._tag, 'Ready');
    Schema.decodeUnknownSync(VideoResult)(video.progress.response?.result);

    const failingEncoder = await runBash({
      ...input,
      command: `bin=$(printf '%s' "$PATH" | cut -d: -f2); printf '#!/bin/sh\n/usr/bin/pkill -9 -x chromium\nexit 9\n' > "$bin/ffmpeg"; chmod +x "$bin/ffmpeg"`,
    });

    assert.equal(failingEncoder.receipt.status, 'completed');

    const started = Schema.decodeUnknownSync(BrowserResult)(
      await invoke(input, 'browser_record_start', { tabId: tab.tab.tabId }),
    );

    assert.equal(started.progress._tag, 'Ready');

    const recording = Schema.decodeUnknownSync(RecordingResult)(started.progress.response?.result);

    const stopped = Schema.decodeUnknownSync(BrowserResult)(
      await invoke(input, 'browser_record_stop', { tabId: tab.tab.tabId, recordingId: recording.recordingId }),
    );

    assert.equal(stopped.progress._tag, 'Ready');

    Schema.decodeUnknownSync(Schema.Struct({ _tag: Schema.Literals(['Failed', 'Uncertain']) }))(
      stopped.progress.response?.result,
    );

    const stillRunning = Schema.decodeUnknownSync(ProcessResult)(
      await invoke(input, 'read_process', { processId: process.processId, machineId: process.machineId }),
    );

    assert.equal(stillRunning.status, 'running');
    assert.equal(stillRunning.machineId, process.machineId);

    const after = await runBash({ ...input, command: 'cat recording-home' });

    assert.equal(after.result.output, sentinel);
    assert.equal(after.receipt.status, 'completed');
  } finally {
    await deleteSandbox(input);
  }
}

async function invoke(
  input: MechContext,
  name: string,
  arguments_: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const marker = `recording-action-${randomUUID()}`;
  const toolCallId = randomUUID();
  const { model } = requireFixtures(input.stack);

  model.configure({
    marker,
    replies: [{ tools: [{ id: toolCallId, name, input: arguments_ }] }, { text: 'Observed' }],
  });

  const sent = await sendNotification({ ...input, text: marker });
  const result = await readModelToolResult({ model, marker, toolCallId, timeoutMs: 180_000 });

  await waitForTurn({ ...input, notificationId: sent.id });

  return result;
}

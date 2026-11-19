import { InstalledActionOrigin, ProcessObservation } from '@mechane/sandbox-wire';
import {
  captureInstalledEvidence,
  installedComputerResourcePath,
  readInstalledComputer,
  requestInstalledComputer,
  runInstalledBash,
  runInstalledBrowserAction,
  withInstalledContext,
} from '@mechane/testing';
import type { ManagedContext, ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const FAILED_RECORDINGS: ReadonlySet<string> = new Set(['Failed', 'Uncertain']);

export async function recordingFailurePreservesEnvironment({ stack }: ScenarioInput): Promise<void> {
  await withInstalledContext({ stack, name: `recording-${randomUUID()}`, run: verifyRecording });
}

async function verifyRecording(context: ManagedContext): Promise<void> {
  const fixture = await captureInstalledEvidence(context);

  const capture = await readInstalledComputer(context, Schema.Struct({ origin: InstalledActionOrigin }), {
    path: installedComputerResourcePath({ collection: 'evidence', id: fixture.videoId }),
  });

  assert.equal(capture.origin.actionId, fixture.recordingStartId);
  assert.equal(capture.origin.sessionId, context.session.id);
  assert.equal(capture.origin.environmentId, context.environment.id);

  const content = await requestInstalledComputer(context, {
    path: installedComputerResourcePath({ collection: 'evidence', part: 'content', id: fixture.videoId }),
  });

  assert.ok(content.ok, 'The successful recording had no stored video');

  const digest = createHash('sha256')
    .update(Buffer.from(await content.arrayBuffer()))
    .digest('hex');

  assert.equal(digest, fixture.videoSha256);

  await runInstalledBash(context, {
    command: `bin=$(printf '%s' "$PATH" | cut -d: -f2); printf '#!/bin/sh\\n/usr/bin/pkill -9 -x chromium\\nexit 9\\n' > "$bin/ffmpeg" && chmod +x "$bin/ffmpeg"`,
  });

  const { result: failing } = await runInstalledBrowserAction(context, {
    _tag: 'RecordStart',
    tabId: fixture.tabId,
    repositoryPath: Option.none(),
  });

  assert.equal(failing._tag, 'Recording');

  const { result: stopped } = await runInstalledBrowserAction(context, {
    _tag: 'RecordStop',
    tabId: fixture.tabId,
    recordingId: failing.recordingId,
  });

  assert.ok(FAILED_RECORDINGS.has(stopped._tag));

  const stillRunning = await readInstalledComputer(context, ProcessObservation, {
    path: installedComputerResourcePath({ collection: 'processes', id: fixture.server.processId }),
  });

  assert.equal(stillRunning.state._tag, 'Running');
  assert.equal(stillRunning.handle.machineId, fixture.server.machineId);

  const stored = await runInstalledBash(context, { command: 'cat recording-home' });

  assert.equal(stored.trim(), fixture.sentinel);
}

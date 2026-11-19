import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ManagedContext } from '../managed-context.ts';
import { runInstalledBrowserAction } from './managed-browser-action.ts';
import { startInstalledProcess } from './managed-process-start.ts';
import { runInstalledBash } from './run-installed-bash.ts';

/** Capture real browser artifacts in the given installed session, preserving the page for recovery checks. */
export async function captureInstalledEvidence(context: ManagedContext) {
  const sentinel = randomUUID();

  const setup = [
    `printf '%s' '${sentinel}' > recording-home`,
    'bin=$(printf "%s" "$PATH" | cut -d: -f2)',
    String.raw`printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox "$@"\n' > "$bin/chromium"`,
    'chmod +x "$bin/chromium"',
  ].join(' && ');

  await runInstalledBash(context, { command: setup });

  const server = await startInstalledProcess(context, {
    command: `node -e 'require("http").createServer((q,s)=>s.end("recording")).listen(43137,"127.0.0.1")'`,
  });

  const ready = await runInstalledBash(context, {
    command: 'curl -fsS --retry 10 --retry-delay 1 --retry-connrefused http://127.0.0.1:43137',
  });

  assert.equal(ready.trim(), 'recording');

  const { result: page } = await runInstalledBrowserAction(context, { _tag: 'Open', url: 'http://127.0.0.1:43137' });

  assert.equal(page._tag, 'Tab');

  const tabId = page.tab.tabId;

  const screenshot = await runInstalledBrowserAction(context, {
    _tag: 'Screenshot',
    tabId,
    repositoryPath: Option.none(),
  });

  assert.equal(screenshot.result._tag, 'Screenshot');

  const screenshotCapture = Option.getOrThrow(screenshot.evidence);

  assert.ok(screenshotCapture.viewer_url !== undefined, 'The screenshot receipt omitted its viewer URL');

  const start = { _tag: 'RecordStart', tabId, repositoryPath: Option.none() } as const;
  const startId = randomUUID();
  const { result: success } = await runInstalledBrowserAction(context, start, startId);

  assert.equal(success._tag, 'Recording');

  const { result: video, evidence } = await runInstalledBrowserAction(context, {
    _tag: 'RecordStop',
    tabId,
    recordingId: success.recordingId,
  });

  assert.equal(video._tag, 'Video');

  const videoCapture = Option.getOrThrow(evidence);

  assert.equal(videoCapture.origin.actionId, startId);
  assert.equal(videoCapture.origin.workspaceId, screenshotCapture.origin.workspaceId);
  assert.ok(videoCapture.viewer_url !== undefined, 'The video receipt omitted its viewer URL');

  return {
    screenshotId: screenshot.result.artifact.artifactId,
    videoId: video.artifact.artifactId,
    screenshotViewerUrl: screenshotCapture.viewer_url,
    videoViewerUrl: videoCapture.viewer_url,
    workspaceId: screenshotCapture.origin.workspaceId,
    videoSha256: video.artifact.sha256,
    recordingStartId: startId,
    server: server.handle,
    tabId,
    sentinel,
  };
}

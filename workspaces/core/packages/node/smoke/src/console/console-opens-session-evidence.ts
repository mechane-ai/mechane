import { consoleSessionEvidencePath, consoleSessionEvidenceViewerPath } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import {
  captureInstalledEvidence,
  CONSOLE_STORAGE_READY_TIMEOUT_MS,
  waitFor,
  withConsoleAgent,
  withInstalledContext,
} from '@mechane/testing';
import type { ManagedContext, ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const VIDEO_RANGE = { first: 1, last: 3 } as const;

export async function consoleOpensSessionEvidence({ stack }: ScenarioInput): Promise<void> {
  await withInstalledContext({ stack, name: `Evidence ${randomUUID()}`, run: inspectReceipts });
}

async function inspectReceipts(context: ManagedContext): Promise<void> {
  const capture = await captureInstalledEvidence(context);
  const { stack, account, agent, session } = context;
  const ready = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };

  await withConsoleAgent({
    stack,
    account,
    agentName: agent.name,
    run: async (page) => {
      await page.getByRole('link', { name: `Open ${session.title ?? session.id}`, exact: true }).click(ready);

      const sessionUrl = page.url();

      await page.getByRole('link', { name: 'Evidence', exact: true }).click(ready);
      await page.waitForURL((url) => url.pathname.endsWith('/evidence'), ready);

      const gallery = new URL(page.url());
      const scope = { workspaceId: capture.workspaceId, agentId: agent.id, sessionId: session.id };

      const evidence = [
        { id: capture.screenshotId, viewerUrl: capture.screenshotViewerUrl, tag: 'img' },
        { id: capture.videoId, viewerUrl: capture.videoViewerUrl, tag: 'video' },
      ] as const;

      for (const artifact of evidence) {
        const identity = { ...scope, artifactId: artifact.id };
        const detail = new URL(consoleSessionEvidenceViewerPath(identity), stack.origin);

        assert.equal(artifact.viewerUrl, detail.href);
        await page.locator(`a[href$="${detail.pathname}"]`).click(ready);
        await page.waitForURL((url) => url.pathname === detail.pathname, ready);
        await page.reload();

        const copy = page.getByRole('button', { name: 'Copy evidence link', exact: true });

        await copy.waitFor(ready);
        assert.equal(await copy.getAttribute('title'), artifact.viewerUrl);

        const contentPath = consoleSessionEvidencePath({ ...identity, includeContent: true });
        const media = page.locator(`${artifact.tag}[src="${contentPath}"]`);

        await media.waitFor(ready);

        const source = await media.getAttribute('src');

        assert.ok(source !== null, 'The viewer did not load a receipt');

        const content = new URL(source, stack.origin);

        assert.equal(content.origin, stack.origin.origin);
        assert.equal(content.pathname, contentPath);
        await waitFor({
          name: 'the browser to decode the captured media',
          read: () =>
            media.evaluate(
              (element: { readonly naturalWidth?: number; readonly videoWidth?: number }) =>
                element.naturalWidth ?? element.videoWidth ?? 0,
            ),
          accept: (width) => width > 0,
        });

        if (artifact.tag === 'video') {
          await media.evaluate((element: { readonly play: () => Promise<void> }) => element.play());
          await waitFor({
            name: 'the captured recording to play',
            read: () => media.evaluate((element: { readonly currentTime: number }) => element.currentTime),
            accept: (time) => time > 0,
          });
        }

        await page.getByRole('link', { name: 'Back to evidence', exact: true }).click(ready);
        await page.waitForURL((url) => url.pathname === gallery.pathname, ready);
        await page.locator(`a[href$="${detail.pathname}"]:focus`).waitFor(ready);

        if (artifact.tag === 'video') {
          const video = await page.request.get(content.href);

          assert.ok(video.ok());

          const bytes = await video.body();

          assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.videoSha256);

          const wrongAgent = consoleSessionEvidencePath({
            ...identity,
            agentId: `agent_${randomUUID()}`,
            includeContent: true,
          });

          const denied = await page.request.get(wrongAgent);

          assert.equal(denied.status(), HttpStatusCode.NotFound);
          assert.notEqual(scope.workspaceId, account.workspaceId);

          const wrongWorkspace = consoleSessionEvidencePath({
            ...identity,
            workspaceId: account.workspaceId,
            includeContent: true,
          });

          const outside = await page.request.get(wrongWorkspace);

          assert.equal(outside.status(), HttpStatusCode.NotFound);

          const { first, last } = VIDEO_RANGE;

          const partial = await page.request.get(content.href, {
            headers: { [HttpHeader.Range]: `bytes=${first}-${last}` },
          });

          assert.equal(partial.status(), HttpStatusCode.PartialContent);
          assert.equal(partial.headers()[HttpHeader.ContentRange], `bytes ${first}-${last}/${bytes.length}`);
          assert.deepEqual(await partial.body(), bytes.subarray(first, last + 1));

          const headersOnly = await page.request.head(content.href);

          assert.equal(headersOnly.status(), HttpStatusCode.Ok);
          assert.equal(headersOnly.headers()[HttpHeader.ContentLength], String(bytes.length));

          const headerBody = await headersOnly.body();

          assert.equal(headerBody.length, 0);
        }
      }

      await page.getByRole('link', { name: 'Back to session', exact: true }).click(ready);
      await page.waitForURL(sessionUrl, ready);
      await page.getByRole('textbox', { name: 'Message this session', exact: true }).waitFor(ready);
    },
  });
}

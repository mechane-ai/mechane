import Anthropic from '@anthropic-ai/sdk';
import { managedWorkspaceId } from '@mechane/managed-protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { CONSOLE_STORAGE_READY_TIMEOUT_MS, createAccount, requireFixtures, withConsoleBrowser } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const FILENAME_PREFIX_LENGTH = 8;

export async function consoleManagesWorkspaceFiles({ stack }: ScenarioInput): Promise<void> {
  const { github } = requireFixtures(stack);
  const marker = randomUUID();
  const account = await createAccount({ stack, login: github.users.owner.login });
  const filename = `brief-${marker.slice(0, FILENAME_PREFIX_LENGTH)}.txt`;
  const body = `console-file-${marker}\n`;

  const client = new Anthropic({
    apiKey: account.token,
    baseURL: stack.origin.origin,
    maxRetries: 0,
    defaultHeaders: { 'anthropic-workspace-id': managedWorkspaceId({ workspaceId: account.workspaceId }) },
  });

  await withConsoleBrowser({
    stack,
    account,
    run: async (page) => {
      const ready = { timeout: CONSOLE_STORAGE_READY_TIMEOUT_MS };

      await page.goto(new URL(`/console/?workspace=${account.workspaceId}`, stack.origin).href);

      const filesLink = page.getByRole('link', { name: 'Files', exact: true });

      await filesLink.waitFor(ready);
      await filesLink.click();

      const uploadButton = page.getByRole('button', { name: 'Upload file', exact: true });

      await uploadButton.waitFor(ready);
      await uploadButton.click();

      const fileInput = page.getByLabel('File', { exact: true });

      await fileInput.waitFor(ready);
      await fileInput.setInputFiles({
        name: filename,
        mimeType: MediaType.PlainText,
        buffer: Buffer.from(body, 'utf8'),
      });

      const [uploadRequest, uploadResponse] = await Promise.all([
        page.waitForRequest(
          (request) =>
            new URL(request.url()).pathname === '/console-api/v1/files' && request.method() === HttpMethod.Post,
          ready,
        ),
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/console-api/v1/files' &&
            response.request().method() === HttpMethod.Post,
          ready,
        ),
        page.getByRole('button', { name: 'Upload', exact: true }).click(),
      ]);

      assert.equal(uploadResponse.status(), HttpStatusCode.Ok);
      assert.equal(uploadRequest.headers()['x-mechane-browser-authentication'], '1');
      assert.equal(uploadRequest.headers()[HttpHeader.Authorization], undefined);
      assert.equal(uploadRequest.headers()[HttpHeader.ApiKey], undefined);

      const listed = await client.beta.files.list();
      const uploaded = listed.data.find((entry) => entry.filename === filename);

      assert.ok(uploaded !== undefined, 'Uploaded Console file was not found in the selected workspace');

      await page.getByText(filename, { exact: true }).waitFor(ready);
      await page.reload();
      await page.getByText(filename, { exact: true }).waitFor(ready);

      const [download] = await Promise.all([
        page.waitForEvent('download', ready),
        page.getByRole('button', { name: `Download ${filename}`, exact: true }).click(),
      ]);

      assert.equal(download.suggestedFilename(), filename);

      const downloadedPath = await download.path();

      assert.equal(await readFile(downloadedPath, 'utf8'), body);

      await page.getByRole('button', { name: `Delete ${filename}`, exact: true }).click();

      const dialog = page.getByRole('alertdialog');

      await dialog.waitFor(ready);
      await dialog.getByRole('button', { name: 'Delete file', exact: true }).click();
      await page.getByText(filename, { exact: true }).waitFor({ ...ready, state: 'hidden' });

      await assert.rejects(client.beta.files.retrieveMetadata(uploaded.id), { status: HttpStatusCode.NotFound });
    },
  });
}

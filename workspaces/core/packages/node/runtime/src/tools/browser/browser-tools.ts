import {
  BROWSER_COORDINATE_MAX_PIXELS,
  BROWSER_INPUT_MAX_CHARS,
  BROWSER_INPUT_TAB_ID_MAX_CHARS,
  BROWSER_NAVIGATION_URL_PATTERN,
  BROWSER_TEXT_MAX_CHARS,
  BROWSER_URL_MAX_CHARS,
  BrowserKey,
} from '@mechane/sandbox-wire';
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import type { RuntimeToolContext } from '../types.ts';
import { browserModelOutput } from './browser-result.ts';
import { executeBrowser, observeBrowser } from './browser.ts';

const Text = z.string().max(BROWSER_TEXT_MAX_CHARS);
const InputText = z.string().max(BROWSER_INPUT_MAX_CHARS);
const Tab = z.string().min(1).max(BROWSER_INPUT_TAB_ID_MAX_CHARS);

const Url = z.string().max(BROWSER_URL_MAX_CHARS).regex(BROWSER_NAVIGATION_URL_PATTERN);

const Coordinate = z.number().min(0).max(BROWSER_COORDINATE_MAX_PIXELS);
const Delta = z.number().min(-BROWSER_COORDINATE_MAX_PIXELS).max(BROWSER_COORDINATE_MAX_PIXELS);
const Capture = z.strictObject({ tabId: Tab, repositoryPath: Text.optional() });

const Target = z.discriminatedUnion('_tag', [
  z.strictObject({ _tag: z.literal('Element'), observationId: z.uuid(), reference: Text }),
  z.strictObject({ _tag: z.literal('Point'), observationId: z.uuid(), positionX: Coordinate, positionY: Coordinate }),
]);

/** All browser effects use the same native run/tool-call identity and real-image output boundary. */
export function createBrowserTools(context: RuntimeToolContext): ToolSet {
  return {
    browser_tabs: tool({
      description: 'List Chromium tabs in this mech’s developer environment.',
      inputSchema: z.strictObject({}),
      execute: (_, options) => executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Tabs' } }),
      toModelOutput: browserModelOutput,
    }),
    browser_open: tool({
      description:
        'Open an HTTP URL, including a localhost development server, in the sandbox’s real Chromium browser.',
      inputSchema: z.strictObject({ url: Url }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Open', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_close: tool({
      description: 'Close an observed browser tab.',
      inputSchema: z.strictObject({ tabId: Tab }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Close', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_navigate: tool({
      description: 'Navigate an existing tab to a URL, then observe its updated page before interacting.',
      inputSchema: z.strictObject({ tabId: Tab, url: Url }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Navigate', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_observe: tool({
      description:
        'Observe the real page with a bounded screenshot and accessibility targets. This transient image is not saved as evidence. Use its observationId for clicks.',
      inputSchema: z.strictObject({ tabId: Tab }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Observe', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_click: tool({
      description:
        'Click a target or coordinate from the latest observation. Stale observations are rejected; observe again after page changes. Do not invent references.',
      inputSchema: z.strictObject({ tabId: Tab, target: Target }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Click', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_type: tool({
      description: 'Type text into the currently focused browser element.',
      inputSchema: z.strictObject({ tabId: Tab, text: InputText }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Type', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_scroll: tool({
      description: 'Scroll at a point within the current viewport, then observe the resulting page.',
      inputSchema: z.strictObject({
        tabId: Tab,
        positionX: Coordinate,
        positionY: Coordinate,
        deltaX: Delta,
        deltaY: Delta,
      }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Scroll', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_key: tool({
      description: 'Press a supported browser key in the focused tab.',
      inputSchema: z.strictObject({ tabId: Tab, key: z.enum(BrowserKey) }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Key', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_screenshot: tool({
      description:
        'Save a PNG as durable evidence and return an authenticated viewer link for a PR. Supply the actual checkout path for observed Git provenance; omit it when unknown. An image alone does not prove tests passed.',
      inputSchema: Capture,
      execute: (input, options) =>
        executeBrowser({
          ...context,
          toolCallId: options.toolCallId,
          action: { _tag: 'Screenshot', ...captureArguments(input) },
        }),
      toModelOutput: browserModelOutput,
    }),
    browser_record_start: tool({
      description:
        'Start recording a tab for at most 60 seconds. Record the interaction, then call browser_record_stop with this recordingId to save the MP4 as evidence.',
      inputSchema: Capture,
      execute: (input, options) =>
        executeBrowser({
          ...context,
          toolCallId: options.toolCallId,
          action: { _tag: 'RecordStart', ...captureArguments(input) },
        }),
      toModelOutput: browserModelOutput,
    }),
    browser_record_stop: tool({
      description:
        'Stop the original recording and save its MP4 with an authenticated viewer link. Links do not grant access; reviewers need current workspace membership.',
      inputSchema: z.strictObject({ tabId: Tab, recordingId: z.uuid() }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'RecordStop', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_console: tool({
      description: 'Read a bounded tail of console messages from the browser tab.',
      inputSchema: z.strictObject({ tabId: Tab }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Console', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_network: tool({
      description: 'Read a bounded tail of browser network diagnostics.',
      inputSchema: z.strictObject({ tabId: Tab }),
      execute: (input, options) =>
        executeBrowser({ ...context, toolCallId: options.toolCallId, action: { _tag: 'Network', ...input } }),
      toModelOutput: browserModelOutput,
    }),
    browser_status: tool({
      description:
        'Reconcile the original browser receipt or pending evidence upload without repeating its browser action. Use this after an uncertain response before issuing another action.',
      inputSchema: z.strictObject({ executionId: z.uuid() }),
      execute: (input) => observeBrowser({ ...context, ...input }),
      toModelOutput: browserModelOutput,
    }),
  };
}

function captureArguments(input: z.infer<typeof Capture>) {
  if (input.repositoryPath === undefined) {
    return { tabId: input.tabId };
  }

  return { tabId: input.tabId, repositoryPath: input.repositoryPath };
}

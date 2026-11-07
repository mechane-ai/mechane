import {
  BROWSER_VIEWPORT_HEIGHT,
  BROWSER_VIEWPORT_WIDTH,
  BrowserClickTarget,
  BrowserKey,
  BrowserOperation,
} from '@mechane/sandbox-wire';
import type { BrowserAction } from '@mechane/sandbox-wire';
import { Effect, Option, Schema } from 'effect';
import type { ObserveBrowserPageInput } from './browser-pages.ts';
import { ContentQuadsReply, DevtoolsCoordinates, EmptyReply, LayoutReply } from './devtools.schemas.ts';
import { devtoolsCommand } from './devtools.ts';
import { BrowserFailed, BrowserFailureKind } from './errors.ts';
import type { BrowserError } from './errors.ts';

const QUAD_COORDINATES = 8;
const QUAD_CORNERS = 4;
const BUTTON_LEFT = 'left';
const QUAD_PAIR_COORDINATES = 2;
const CONTROL_MODIFIER = 2;

type BrowserInputAction =
  | typeof BrowserAction.cases.Click.Type
  | typeof BrowserAction.cases.Type.Type
  | typeof BrowserAction.cases.Scroll.Type
  | typeof BrowserAction.cases.Key.Type;

type PerformBrowserInput = ObserveBrowserPageInput & { readonly action: BrowserInputAction };

/** Applies browser input against the current tab; clicks require a still-valid observed target. */
export const performBrowserInput = Effect.fn('performBrowserInput')(function* ({
  connection,
  page,
  action,
}: PerformBrowserInput): Effect.fn.Return<void, BrowserError> {
  const sessionId = Option.some(page.sessionId);

  yield* devtoolsCommand({ connection, sessionId, method: 'Page.bringToFront', params: {}, schema: EmptyReply });

  switch (action._tag) {
    case BrowserOperation.Type:
      page.invalidateObservation();

      yield* devtoolsCommand({
        connection,
        sessionId,
        method: 'Input.insertText',
        params: { text: action.text },
        schema: EmptyReply,
      });

      return;
    case BrowserOperation.Scroll: {
      const coordinates = Schema.encodeSync(DevtoolsCoordinates)(action);

      page.invalidateObservation();
      yield* devtoolsCommand({
        connection,
        sessionId,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseWheel', ...coordinates, deltaX: action.deltaX, deltaY: action.deltaY },
        schema: EmptyReply,
      });

      return;
    }
    case BrowserOperation.Key: {
      page.invalidateObservation();

      const key = browserKey({ key: action.key });

      yield* devtoolsCommand({
        connection,
        sessionId,
        method: 'Input.dispatchKeyEvent',
        params: { type: 'keyDown', ...key },
        schema: EmptyReply,
      });
      yield* devtoolsCommand({
        connection,
        sessionId,
        method: 'Input.dispatchKeyEvent',
        params: { type: 'keyUp', ...key },
        schema: EmptyReply,
      });

      return;
    }
    case BrowserOperation.Click: {
      const point = yield* browserClickPoint({ connection, page, action });
      const coordinates = Schema.encodeSync(DevtoolsCoordinates)(point);

      page.invalidateObservation();

      yield* devtoolsCommand({
        connection,
        sessionId,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mousePressed', ...coordinates, button: BUTTON_LEFT, clickCount: 1 },
        schema: EmptyReply,
      });
      yield* devtoolsCommand({
        connection,
        sessionId,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseReleased', ...coordinates, button: BUTTON_LEFT, clickCount: 1 },
        schema: EmptyReply,
      });
    }
  }
});

type BrowserClickPointInput = ObserveBrowserPageInput & { readonly action: typeof BrowserAction.cases.Click.Type };

type BrowserPoint = { readonly positionX: number; readonly positionY: number };

const browserClickPoint = Effect.fn('browserClickPoint')(function* ({
  connection,
  page,
  action,
}: BrowserClickPointInput): Effect.fn.Return<BrowserPoint, BrowserError> {
  const observation = page.observation();

  if (Option.isNone(observation) || observation.value.observationId !== action.target.observationId) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser target observation is stale; observe this tab again',
    });
  }

  const sessionId = Option.some(page.sessionId);

  const layout = yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'Page.getLayoutMetrics',
    params: {},
    schema: LayoutReply,
  });

  const previous = observation.value.viewport;
  const current = layout.cssVisualViewport;

  const didScroll = previous.pageX !== current.pageX || previous.pageY !== current.pageY;
  const didResize = previous.clientWidth !== current.clientWidth || previous.clientHeight !== current.clientHeight;

  if (didScroll || didResize) {
    page.invalidateObservation();

    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser viewport changed after observation; observe this tab again',
    });
  }

  if (BrowserClickTarget.guards.Point(action.target)) {
    if (action.target.positionX >= BROWSER_VIEWPORT_WIDTH || action.target.positionY >= BROWSER_VIEWPORT_HEIGHT) {
      return yield* new BrowserFailed({
        kind: BrowserFailureKind.Target,
        reason: 'browser click is outside the observed viewport',
      });
    }

    return { positionX: action.target.positionX, positionY: action.target.positionY };
  }

  const observedNode = observation.value.nodes.get(action.target.reference);
  const backendNodeId = Option.fromNullishOr(observedNode);

  if (Option.isNone(backendNodeId)) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser target was not present in the named observation',
    });
  }

  yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'DOM.scrollIntoViewIfNeeded',
    params: { backendNodeId: backendNodeId.value },
    schema: EmptyReply,
  });

  const response = yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'DOM.getContentQuads',
    params: { backendNodeId: backendNodeId.value },
    schema: ContentQuadsReply,
  });

  const quad = Option.fromNullishOr(response.quads[0]);

  if (Option.isNone(quad) || quad.value.length !== QUAD_COORDINATES) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser target has no visible click area',
    });
  }

  const horizontal = quad.value.filter((_value, index) => index % QUAD_PAIR_COORDINATES === 0);
  const vertical = quad.value.filter((_value, index) => index % QUAD_PAIR_COORDINATES === 1);
  const positionX = horizontal.reduce((sum, value) => sum + value, 0) / QUAD_CORNERS;
  const positionY = vertical.reduce((sum, value) => sum + value, 0) / QUAD_CORNERS;

  const isOutsideHorizontal = positionX < 0 || positionX >= BROWSER_VIEWPORT_WIDTH;
  const isOutsideVertical = positionY < 0 || positionY >= BROWSER_VIEWPORT_HEIGHT;

  if (isOutsideHorizontal || isOutsideVertical) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser target is outside the viewport after scrolling',
    });
  }

  return { positionX, positionY };
});

type BrowserKeyInput = { readonly key: (typeof BrowserKey)[keyof typeof BrowserKey] };

type DevtoolsKey = {
  readonly key: string;
  readonly code: string;
  readonly windowsVirtualKeyCode: number;
  readonly modifiers: number;
  readonly text: string;
};

function browserKey({ key }: BrowserKeyInput): DevtoolsKey {
  const codes = {
    Enter: 13,
    Tab: 9,
    Escape: 27,
    Backspace: 8,
    Delete: 46,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
    Home: 36,
    End: 35,
    PageUp: 33,
    PageDown: 34,
    Space: 32,
    SelectAll: 65,
  } as const;

  switch (key) {
    case BrowserKey.SelectAll:
      return { key: 'a', code: 'KeyA', windowsVirtualKeyCode: codes[key], modifiers: CONTROL_MODIFIER, text: '' };
    case BrowserKey.Space:
      return { key: ' ', code: 'Space', windowsVirtualKeyCode: codes[key], modifiers: 0, text: ' ' };
    case BrowserKey.Enter:
      return { key, code: key, windowsVirtualKeyCode: codes[key], modifiers: 0, text: '\r' };
    case BrowserKey.Tab:
    case BrowserKey.Escape:
    case BrowserKey.Backspace:
    case BrowserKey.Delete:
    case BrowserKey.ArrowUp:
    case BrowserKey.ArrowDown:
    case BrowserKey.ArrowLeft:
    case BrowserKey.ArrowRight:
    case BrowserKey.Home:
    case BrowserKey.End:
    case BrowserKey.PageUp:
    case BrowserKey.PageDown:
      return { key, code: key, windowsVirtualKeyCode: codes[key], modifiers: 0, text: '' };
  }
}

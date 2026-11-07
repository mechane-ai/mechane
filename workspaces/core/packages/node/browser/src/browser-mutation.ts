import { Effect } from 'effect';
import type { DevtoolsConnection } from './devtools.ts';
import type { BrowserError } from './errors.ts';

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'Target.createTarget',
  'Target.closeTarget',
  'Page.navigate',
  'DOM.scrollIntoViewIfNeeded',
  'Input.insertText',
  'Input.dispatchMouseEvent',
  'Input.dispatchKeyEvent',
  'Page.startScreenRecording',
  'Page.stopScreenRecording',
]);

type BrowserMutationInput = { readonly connection: DevtoolsConnection; readonly acknowledge: () => void };

/** Tracks acknowledged mutations so a later failure cannot claim the compound action had no effect. */
export function trackBrowserMutations({ connection, acknowledge }: BrowserMutationInput): DevtoolsConnection {
  const call: DevtoolsConnection['call'] = Effect.fn('call')(function* (command): Effect.fn.Return<
    unknown,
    BrowserError
  > {
    const response = yield* connection.call(command);

    if (MUTATING_METHODS.has(command.method)) {
      acknowledge();
    }

    return response;
  });

  return { ...connection, call };
}

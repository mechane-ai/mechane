import { ConsoleView, PagePath } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { Option, Schema } from 'effect';

const CONSOLE_ROOTS: ReadonlySet<string> = new Set([PagePath.Console, '/console/']);
const RESOURCE_KEYS: ReadonlySet<string> = new Set(['workspace', 'mech', 'turn', 'request']);
const isView = Schema.is(Schema.Enum(ConsoleView));
type ConsoleDestinationInput = { readonly value: string; readonly origin: URL };

/** Only same-installation console coordinates may survive sign-in in its short-lived return cookie. */
export function consoleDestination({ value, origin }: ConsoleDestinationInput): Option.Option<string> {
  if (!URL.canParse(value, origin.href)) {
    return Option.none();
  }

  const incoming = new URL(value, origin);

  if (incoming.origin !== origin.origin || !CONSOLE_ROOTS.has(incoming.pathname)) {
    return Option.none();
  }

  const next = new URL(PagePath.Console, origin);
  const ids = [...incoming.searchParams].filter(([key, id]) => RESOURCE_KEYS.has(key) && Schema.is(RecordId)(id));

  const coordinates = new URLSearchParams(ids);
  next.search = coordinates.toString();

  const view = incoming.searchParams.get('view');

  if (isView(view)) {
    next.searchParams.set('view', view);
  }

  const inspect = incoming.searchParams.get('inspect');

  if (isView(inspect)) {
    next.searchParams.set('inspect', inspect);
  }

  const rawEvent = incoming.searchParams.get('event');
  const event = Number(rawEvent);

  if (Number.isSafeInteger(event) && event > 0) {
    const sequence = String(event);

    next.searchParams.set('event', sequence);
  }

  const path = next.pathname + next.search;

  return Option.some(path);
}

import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode, MediaType, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

const TOOL_ID_CHARS = 128;
const RUBRIC_CHARS = 262_144;
const DENIAL_CHARS = 10_000;
const INITIAL_EVENT_MAX_ENTRIES = 50;
const INITIAL_DOCUMENT_MAX_FILES = 100;
const initialEventTypes: ReadonlySet<string> = new Set(['user.message', 'user.define_outcome']);

const ToolUseId = Schema.NonEmptyString.check(Schema.isMaxLength(TOOL_ID_CHARS));
const Text = Schema.Struct({ type: Schema.Literal('text'), text: Schema.NonEmptyString });

const Base64 = Schema.Struct({
  type: Schema.Literal('base64'),
  data: Schema.NonEmptyString,
  media_type: Schema.NonEmptyString,
});

const Url = Schema.Struct({ type: Schema.Literal('url'), url: Schema.NonEmptyString });
const File = Schema.Struct({ type: Schema.Literal('file'), file_id: Schema.NonEmptyString });

const PlainText = Schema.Struct({
  type: Schema.Literal('text'),
  data: Schema.NonEmptyString,
  media_type: Schema.Literal(MediaType.PlainText),
});

const OptionalText = Schema.optionalKey(Schema.NullOr(Schema.String));
const Image = Schema.Struct({ type: Schema.Literal('image'), source: Schema.Union([Base64, Url, File]) });

const Document = Schema.Struct({
  type: Schema.Literal('document'),
  source: Schema.Union([Base64, PlainText, Url, File]),
  title: OptionalText,
  context: OptionalText,
});

const Search = Schema.Struct({
  type: Schema.Literal('search_result'),
  source: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  citations: Schema.toEncoded(wireStruct({ fields: { isEnabled: Schema.Boolean } })),
  content: Schema.Array(Text),
});

const Result = Schema.Struct({
  content: Schema.optionalKey(Schema.Array(Schema.Union([Text, Image, Document, Search]))),
  is_error: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
});

const Rubric = Schema.Union([
  File,
  Schema.Struct({ type: Schema.Literal('text'), content: Schema.String.check(Schema.isMaxLength(RUBRIC_CHARS)) }),
]);

const InputEvent = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('user.message'),
    content: Schema.Array(Schema.Union([Text, Image, Document, Schema.Struct({ type: Schema.Literal('redacted') })])),
  }),
  Schema.Struct({ type: Schema.Literal('system.message'), content: Schema.Array(Text) }),
  Schema.Struct({ type: Schema.Literal('user.interrupt'), session_thread_id: OptionalText }),
  Schema.Struct({ type: Schema.Literal('user.tool_result'), tool_use_id: ToolUseId, ...Result.fields }),
  Schema.Struct({ type: Schema.Literal('user.custom_tool_result'), custom_tool_use_id: ToolUseId, ...Result.fields }),
  Schema.Struct({
    type: Schema.Literal('user.tool_confirmation'),
    tool_use_id: ToolUseId,
    result: Schema.Literals(['allow', 'deny']),
    deny_message: Schema.optionalKey(Schema.NullOr(Schema.String.check(Schema.isMaxLength(DENIAL_CHARS)))),
  }).check(
    Schema.makeFilter((event) => event.result === 'deny' || typeof event.deny_message !== 'string', {
      expected: 'a deny_message only on a deny decision',
    }),
  ),
  Schema.Struct({
    type: Schema.Literal('user.define_outcome'),
    description: Schema.String,
    rubric: Rubric,
    max_iterations: Schema.optionalKey(Schema.NullOr(Schema.Int)),
  }),
]);

export type ManagedInputEvent = typeof InputEvent.Type;

const decode = Schema.decodeUnknownSync(Schema.Array(InputEvent), { onExcessProperty: 'error' });

function decodeInputs(raw: unknown) {
  try {
    return decode(raw);
  } catch (error) {
    if (!Schema.isSchemaError(error)) {
      throw error;
    }

    failManagedRequest(HttpStatusCode.BadRequest, 'Invalid session event type, field or content block');
  }
}

export function validateManagedInputs(raw: unknown, isInitial = false): ReadonlyArray<ManagedInputEvent> {
  const events = decodeInputs(raw);

  if (!isInitial) {
    return events;
  }

  if (events.length > INITIAL_EVENT_MAX_ENTRIES || events.some((event) => !initialEventTypes.has(event.type))) {
    failManagedRequest(
      HttpStatusCode.BadRequest,
      'initial_events accepts up to 50 user.message or user.define_outcome events',
    );
  }

  if (events.filter((event) => event.type === 'user.define_outcome').length > 1) {
    failManagedRequest(HttpStatusCode.BadRequest, 'initial_events accepts at most one outcome');
  }

  const files = events
    .filter((event) => event.type === 'user.message')
    .flatMap((event) => event.content)
    .filter((block) => block.type === 'document' && block.source.type === 'file');

  if (files.length > INITIAL_DOCUMENT_MAX_FILES) {
    failManagedRequest(HttpStatusCode.BadRequest, 'initial_events accepts at most 100 file-sourced documents');
  }

  return events;
}

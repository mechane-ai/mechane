import { Schema } from 'effect';

/** A part of a message's content; the scripted upstream reads only the text of a text part. */
export const ContentPart = Schema.Struct({
  type: Schema.String,
  /** The part's text, absent from a part of another type. */
  text: Schema.OptionFromOptional(Schema.String),
});

export type ContentPart = typeof ContentPart.Type;

/** A chat message as the chat-completions API sends it. */
export const ChatMessage = Schema.Struct({
  role: Schema.String,
  /** The message's text or its parts, absent from an assistant message that only calls tools. */
  content: Schema.OptionFromOptionalNullOr(Schema.Union([Schema.String, Schema.Array(ContentPart)])),
});

export type ChatMessage = typeof ChatMessage.Type;

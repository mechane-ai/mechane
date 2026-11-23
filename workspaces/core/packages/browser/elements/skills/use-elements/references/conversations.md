# Conversations and agent activity

Import from `@mechane-ai/elements/ai`. These parts render supplied records. They do not call a model, start a run, store
messages or decide permissions.

## The transcript

Compose `Conversation.Root`, `Viewport`, `Content` and one `Item` per message, with `JumpToLatest` inside the root.

- Give the viewport a label and each item a stable `messageId`. Key the root by conversation identity.
- A parent with a bounded height makes the transcript scroll. Without one it grows in page flow.
- A live conversation follows new content while the reader is at the end, and stops when they scroll up. Do not add a
  scroll effect of your own.
- Mark the user's just-sent item with `shouldRevealOnAppend`, and keep its ID through acknowledgement.
- Use `initialPosition="start"` and `shouldFollow={false}` for a historical page.
- Pass `isStreaming` to `Content` while a reply is incomplete, and to the one `Markdown` message that is streaming.

`Message` takes an author, metadata, content, attachments and actions. Use `variant="chat"` for a compact chat with
end-aligned user messages. Render text with `Markdown` from `/content/markdown`. `MessageAction` is a named icon button
that shows on hover and focus. `ReplyIndicator` shows a supplied waiting label; remove it when real output arrives.

## The prompt

`PromptInput` takes `value`, `onValueChange` and `onSubmit`. The app owns the draft, the request identity, the result
and any retry. The component never clears the text, so a failed send keeps its draft.

- Enter adds a line by default. `enterBehavior="submit"` submits, and Shift and Enter adds a line. Command or Control
  with Enter always submits.
- Pass `history`, oldest first, for Arrow Up recall on the first line.
- Supplying `onStop` shows Stop in place of Send.
- Use `isCompact` for a composer pinned below a conversation.
- Model choice, suggestions and attachments go in the `controls` and `attachments` slots.

## Activity, approvals and sources

| To show                             | Use                                                                |
| ----------------------------------- | ------------------------------------------------------------------ |
| A recorded shell command and output | `CommandActivity`                                                  |
| Ordered recorded steps, nested runs | `Trace` from `/content`                                            |
| Tool input and output               | `JsonViewer`, `CodeBlock`, `LogViewer`, `StackTrace`               |
| A decision a person must make       | `Approval` with an identified request                              |
| Where an answer came from           | `Sources` and `InlineCitation`                                     |
| A file change                       | `DiffViewer` from `/content/diff`, `FileTree` from `/content/tree` |
| Context use                         | `Meter` from `/feedback`, with `null` for unknown                  |

An `Approval` reports intent. Show it as settled only after the application acknowledges the outcome. A supplied summary
is not a model's hidden reasoning, and a recorded command is not a live terminal. Label them as what they are.

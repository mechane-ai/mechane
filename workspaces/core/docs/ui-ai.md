# Conversation and agent interfaces

Import the AI presentation parts from `@mechane-ai/ui/ai` and the package stylesheet from `@mechane-ai/ui/styles.css`.
These components render supplied records and commands. They do not import a model SDK, start runs, store messages, or
decide permissions. They use the same typography, borders, controls, and spacing as the rest of Mechane UI.

## Conversations

`Conversation` owns scrolling through the headless `@shadcn/react/message-scroller` primitive. Compose `Root`,
`Viewport`, `Content`, and stable `Item` rows. Add `JumpToLatest` inside the root. Give the viewport a descriptive label
and each item a stable `messageId`. Key the root by conversation identity when switching conversations.

A height-constrained parent creates a scrolling transcript. Without that constraint, the content grows in ordinary
document flow. `initialPosition="start"` and `follow={false}` suit a historical page. Live conversations default to the
end and follow new content while the reader remains there. Prepending older rows preserves the reader's position. The
jump action returns focus to the viewport. Updates and streamed text do not move focus.

Pass `streaming` to `Content` while a reply is incomplete. The transcript announces added records and waits for a busy
region to settle. It does not announce each text mutation. `Message` presents an author, metadata, content, attachments,
and actions. Render message text with `Markdown` from `/content`; use `MessageAttachment` for supplied file records.
Both attachments and sources use the content module's safe destination policy.

The scroller wrapper exposes ordinary live-edge following and prepend preservation. It does not expose the upstream
anchored-turn mode. That mode has a known scrollbar-drag issue in the pinned dependency. This keeps one scroll owner
without reproducing its engine in the UI package. See the
[upstream report](https://github.com/shadcn-ui/ui/issues/12278).

## Prompt composition

`PromptInput` receives `value`, `onValueChange`, and `onSubmit`. The application owns the draft, request identifier,
submission result, and retry policy. The component never clears text. A failed or uncertain request can therefore retain
both the draft and the application's original request identity.

Newline is the default Enter behavior. `enterBehavior="submit"` submits through the native form and its validation;
Shift+Enter adds a line. Composition input and held Enter do not submit. Pending input becomes read-only to preserve
keyboard focus. Explicitly disabled input retains normal disabled semantics.

Supplying `onStop` shows Stop in place of Send. Enter cannot submit while Stop is visible. Pending, disabled, and
`submitDisabled` also gate programmatic form submission. Model controls, suggestions, attachments, and context capacity
compose through the `controls` and `attachments` slots. Applications supply their availability and actions.

## Activity and sources

`Approval` accepts an identified pending request with approve and deny callbacks. Its `busy` state disables duplicate
decisions. A settled approval requires the application's acknowledged outcome and exposes no decision callbacks.
Clicking a button does not itself change the displayed status.

`Sources` renders supplied source records in their supplied order. `InlineCitation` opens the same record in a Base UI
popover. It supports keyboard and touch and links to the real supplied destination. Source provenance and visibility
remain application decisions.

Use the shared `Trace` for recorded steps, `Collapsible` for supplied summaries, and content viewers for recorded input
and output. A supplied explanation is not evidence of a model's hidden reasoning. A recorded command is not a live
terminal. Context capacity uses `Meter` with `null` for unknown usage and an explicit display label.

## Recipe coverage

The catalog covers the current [shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements) patterns through a small set
of behavior owners. A recipe composes supported parts rather than introducing another execution state machine.

| Reference pattern | Mechane composition                                    | Catalog example                               |
| ----------------- | ------------------------------------------------------ | --------------------------------------------- |
| Chat              | Conversation, Message, Markdown, PromptInput           | AI / Conversation / Chat                      |
| Message           | Author, metadata, content, attachment and action slots | AI / Conversation / Message parts             |
| Prompt input      | Controlled native form with send or stop               | AI / Prompt input / Composer, Stop and draft  |
| Model selector    | Controlled searchable Combobox                         | AI / Prompt input / Composer                  |
| Suggestion        | Buttons that update the application draft              | AI / Prompt input / Composer                  |
| Tool              | Trace with JsonViewer, CodeBlock and recorded output   | AI / Activity recipes / Tool                  |
| Reasoning         | Disclosure containing a supplied summary               | AI / Activity recipes / Supplied summary      |
| Chain of thought  | Ordered recorded steps, without invented reasoning     | AI / Activity recipes / Supplied summary      |
| Plan              | Planned steps with supplied progress                   | AI / Activity recipes / Plan and queue        |
| Task              | Recorded execution steps                               | AI / Activity recipes / Plan and queue        |
| Queue             | Pending or cancelled follow-ups                        | AI / Activity recipes / Plan and queue        |
| Subagent          | A supplied child run and nested steps                  | AI / Activity recipes / Subagent              |
| Confirmation      | Identified Approval with acknowledged outcome          | AI / Activity recipes / Confirmation          |
| Context           | Meter and Popover, with unknown distinct from zero     | AI / Prompt input / Composer, Unknown context |
| Sources           | Ordered supplied source records                        | AI / Sources / Citations                      |
| Inline citation   | Keyboard and touch source preview                      | AI / Sources / Citations                      |
| Checkpoint        | Marker and application restore/fork commands           | AI / Activity recipes / Checkpoint            |
| File tree         | Controlled FileTree and selected CodeBlock             | AI / Workspace / Files                        |
| Terminal          | Recorded command, exit status and LogViewer            | AI / Activity recipes / Recorded output       |
| Stack trace       | Supplied error and navigable frames                    | AI / Activity recipes / Recorded output       |
| Test results      | Summary and recorded checks with output                | AI / Activity recipes / Test results          |

Stories use synthetic records and explicit local interactions. They make no external requests. Voice capture, workflow
editing, shell transport, and executable previews are outside this module. The
[public entry](../packages/browser/ui/packages/ai/src/index.ts) and adjacent prop types define the supported API.

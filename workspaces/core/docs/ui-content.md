# Content

Import content presentation from `@mechane-ai/elements/content`. Markdown, links, code, diffs, and file trees have
focused entry points: `@mechane-ai/elements/content/markdown`, `/content/link`, `/content/code`, `/content/diff`, and
`/content/tree`. Import `@mechane-ai/elements/styles.css` once, alongside the rest of the UI. Each viewer uses the
shared light and dark tokens without requiring Tailwind or a StyleX compiler in its consumer.

Applications supply text, files, and callbacks. They own fetching, redaction, permissions, uploads, and persistence. The
[content contract](../.contracts/116-ui-content-rendering/CONTRACT.md) defines the rendering boundary.

## Markdown and links

[Markdown](../packages/browser/elements/packages/content/src/markdown/markdown.tsx) uses Streamdown for completed and
incomplete Markdown. Every styled block uses Mechane components or styles; there is no Streamdown stylesheet dependency.
Fenced code uses CodeBlock. Streaming updates preserve partial fences without adding token-by-token announcements.

```tsx
import { Markdown } from '@mechane-ai/elements/content/markdown';

<Markdown streaming={isStreaming}>{reply}</Markdown>;
```

Raw HTML is disabled. Images display an explicit link labelled by their alternative text without requesting their
source. Links admit HTTP, HTTPS, mail, and relative destinations through the browser's URL parser. Invalid or executable
destinations become plain text. [ContentLink](../packages/browser/elements/packages/content/src/content-link.tsx)
applies the same policy to citations and attachments outside Markdown. Import it from `/content/link` when the consumer
needs only a link; that entry does not load the Markdown renderer. Applications can render trusted media separately when
users request it.

Set `headingLevel` when embedding Markdown below a page heading; the renderer shifts the supplied hierarchy and caps it
at `h6`. `MarkdownPreview` uses the same parsing and URL policy but emits only inert text, including image alt text. Use
it inside record links; the application owns excerpt length and clipping. It creates no nested links or code viewer.

## Code and changes

[CodeBlock](../packages/browser/elements/packages/content/src/code/code-block.tsx) accepts source text and an optional
filename and language. Pierre Highlights loads when the viewer mounts. Its incremental tokenizer reuses lexical state
for appended text and resets when source is replaced. Unsupported languages and failed initialization retain plain
source. Long lines skip token styling. Rendering stops at 200,000 characters and the configured line limit, with visible
truncation. Copy always uses the original string, including its whitespace and line endings.

Selections and annotations use one-based source line numbers. An annotation describes one line and can compose shared
controls. It does not change the source or its copied value. Code updates are their own revision evidence; callers do
not need to invent cache identifiers.

[DiffViewer](../packages/browser/elements/packages/content/src/diff/diff-source.ts) accepts either a patch or
before/after files. A null side represents an added or removed file. The type rejects both missing sides and mixed
patch/file inputs. Layout can be unified or split. An annotation names its file, one-based line, and `old` or `new`
side.

Pierre Diffs owns diff geometry, hunks, and the render window. It uses the same Highlights theme. Invalid patches,
failed initialization, and oversized inputs retain the supplied patch or files. No viewer fetches missing context. The
original input also remains available in a disclosure beneath rendered changes. Source changes rebuild the parsed diff,
and the adapter does not assign a stale worker cache key.

The [Pierre bridge](../packages/browser/elements/packages/content/src/pierre-theme.ts) maps Mechane tokens into lexical
colors and Shadow DOM styles. Highlights includes its WebAssembly bytes in its module. Renderer imports resolve through
the package; there is no external grammar or asset CDN. Production builds must retain their dynamic chunks.

## Files

[FileTree](../packages/browser/elements/packages/content/src/tree/file-tree-types.ts) accepts paths, optional Git
statuses, and controlled selected paths. Pierre Trees owns expansion, search, keyboard navigation, and virtualization. A
shared Input sits outside the tree's semantic boundary and reads the model-owned search state; Tab moves into matching
rows, and Escape clears the query. The adapter updates its persistent model when paths, statuses, or selection change.
It reports selection requests to the application and reconciles the model to the application's accepted selection.

```tsx
import { FileTree } from '@mechane-ai/elements/content/tree';

<FileTree
  label="Workspace files"
  paths={paths}
  selectedPaths={selectedPaths}
  onSelectedPathsChange={setSelectedPaths}
/>;
```

Paths remain the stable identity across reordering. The tree accepts unsorted input and lets Pierre build its directory
ordering. It has no rename, drag/drop, or file transport. Before the renderer loads, a bounded list of selectable paths
remains available. Compose the selected path with CodeBlock or DiffViewer in the application.

## Recorded values

[JsonViewer](../packages/browser/elements/packages/content/src/json-viewer.tsx) receives JSON values rather than
arbitrary runtime objects. Fields expand lazily. Per-branch entry and depth limits and shortened string previews remain
visible; Copy JSON serializes the complete supplied value only when requested. Redact credentials before passing them
in.

[LogViewer](../packages/browser/elements/packages/content/src/log-viewer.tsx) displays recorded text. It strips ANSI
sequences for presentation, keeps the last 200,000 characters and the configured line limit, and lets the reader pause
following output. Copy retains the supplied string. It never attaches a terminal, launches commands, or interprets
escape sequences as browser behavior.

[StackTrace](../packages/browser/elements/packages/content/src/stack-trace.tsx) composes an error summary and stable
frames. Applications supply each frame's file destination and optional source. Empty frames remain an explicit state
rather than a fabricated stack.

Synthetic examples live beside each component in the shared Storybook catalog. They cover incomplete Markdown, blocked
links and images, source annotations, diff sides, updated file lists, empty output, and visible truncation. These are
component documentation; application traces still need to supply recorded evidence.

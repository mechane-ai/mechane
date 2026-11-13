---
name: ui-component-usage-guidance
paths: ["packages/browser/elements/**","packages/browser/console-views/**","packages/browser/console/.storybook/**"]
message: Document each public component's purpose, use, alternatives, and status beside its source, and generate the catalog from it.
---

## Rules

Document every public component beside its source with its purpose, when to use it, and a nearby alternative or common misuse.
State in each component's guidance what the application must supply and decide, such as data, formatting, and permissions.
Document each non-obvious input where it is declared and each non-obvious example where it is defined.
Write guidance for what the interface cannot express, such as selection, composition, and misuse, rather than restating input types.
Mark each public component's support status in its source documentation, and define in the catalog what each status promises consumers.

Keep foundations, token use, component selection, and composition guidance in the component catalog beside the examples, not in application documentation.
Keep component guidance in source documentation, examples, or catalog pages, so the generated catalog exposes all of it.
Document the intended meaning and search terms of each name in a finite catalog of choices, such as icon names, beside that catalog's examples.

Generate the catalog and all agent-facing component metadata from component source, examples, and guidance pages, and never maintain a parallel registry.
List every public export in the generated catalog with its guidance and status.
Verify the inputs the catalog extracts for each component against its public interface.
Give coding agents the catalog through its supported query interface, and never read its generated metadata files from product code.

Keep a component private until its public behavior, types, examples, and guidance are complete.
Change a component's guidance and examples in the same change as its behavior or interface, so the catalog never describes another version.

## Checks

Build the catalog and confirm every public export appears with its purpose, usage, alternative, and status.
Compare the catalog's extracted inputs for each changed component with its public interface.
Query the catalog through its agent interface for a changed component, and confirm it returns that component's guidance and the guidance pages.
Search for hand-maintained component registries or metadata files, and for product code that reads generated catalog files.
Review changed public components: does the guidance say when to choose each over its nearby alternative, and what its types cannot express?

## Local adaptations

Use the public `docs/visual-system.md#composition-decisions` as the shared component-selection guide.
Colocated guidance names the containing task, its inset and scroll owner, and the nearby alternative that changes behavior.
Use ordinary stacked sections as the default for related page content. A Panel or report frame needs a bounded unit.
Show full-width tables within their containing task region and inset chart content in the existing layout examples.
Review the actual composition before adding another surface or layout API.

The chart report examples in `layout/src/page-content.stories.tsx` place summaries inside their explanatory charts.
The ReportContent examples in `layout/src/collection-layout.stories.tsx` document one inset summary followed by full-width rows,
including a section without a summary. Pass content directly to the summary slot; do not nest PageContent inside it.
The Metric examples in `collections/src/record-details.stories.tsx` document formatted values, qualifications,
pending geometry and passive trends. Review the populations and time windows in the consuming application.

Read the selected story beside its component guide. Can a caller choose the appropriate layout and identify which
component owns width, spacing, scrolling and state retention? Document legitimate embedded contexts at that owner.

Colocated stories, source guidance, and package documentation describe implemented public components.
A component family may document its public parts in one story file. Supported means that the component is part of
the published `@mechane-ai/elements` API, with reviewed behavior, exported types, examples, and maintained guidance.
Console adoption is useful integration evidence, not a prerequisite for supporting a generic library component.
The current library families inherit the `supported` tag from the Storybook preview; Foundations defines its promise
once for the package release. Application-only Screens opt out. This inherited source metadata fulfills each family's
status marking without duplicating a status sentence in every part. Any different support status must be explicit in
that family's metadata and guidance.
Plans and research do not create callable APIs. Keep an unfinished family private rather than exporting a placeholder.

The upstream clauses "Generate the catalog and all agent-facing component metadata from component source, examples,
and guidance pages, and never maintain a parallel registry." and "Give coding agents the catalog through its supported
query interface, and never read its generated metadata files from product code." use ordinary Storybook documentation
and story metadata in this adoption. No custom registry, metadata service, or agent query interface is required.
Add a supported upstream query integration only with an actual consumer. Review catalog guidance and public types
directly instead of running the upstream agent-query check.
The pinned Storybook extractor does not infer every compound object's props. Document those parts through family
metadata, representative compositions, and the linked source or exported types. Verify whatever inputs the catalog
extracts, but do not claim exhaustive prop tables or add a custom extractor to duplicate the TypeScript interface.

Lucide components supply control and navigation icons without a separate name registry. The original `AgentAvatar`
identity catalog uses stable shape and palette names; its avatar and picker stories show those named choices.
Keep component guidance beside its owner; the Console guide explains application composition and workflows.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

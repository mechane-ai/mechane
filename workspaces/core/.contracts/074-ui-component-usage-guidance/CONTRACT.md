---
name: ui-component-usage-guidance
paths: ["packages/browser/ui/**","packages/browser/ui-tokens/**","packages/browser/ui-layout/**","packages/browser/ui-charts/**","packages/browser/console-views/**","packages/browser/console/.storybook/**"]
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

Colocated stories, source guidance, and package documentation describe implemented public components.
A component family may document its public parts in one story file. The catalog describes the shipped components as
supported and defines that status as supported by the current Console release; planned components are not callable APIs.

The upstream clauses "Generate the catalog and all agent-facing component metadata from component source, examples,
and guidance pages, and never maintain a parallel registry." and "Give coding agents the catalog through its supported
query interface, and never read its generated metadata files from product code." use ordinary Storybook documentation
and story metadata in this adoption. No custom registry, metadata service, or agent query interface is required.
Add a supported upstream query integration only with an actual consumer. Review catalog guidance and public types
directly instead of running the upstream agent-query check.
The pinned Storybook extractor does not infer every compound object's props. Document those parts through family
metadata, representative compositions, and the linked source or exported types. Verify whatever inputs the catalog
extracts, but do not claim exhaustive prop tables or add a custom extractor to duplicate the TypeScript interface.

Lucide components remain the icon vocabulary. There is no separate finite icon-name catalog to document.
Keep component guidance beside its owner; the Console guide explains application composition and workflows.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

# Form controls

The supported controls use Base UI for selection, number entry, and focus behavior. The application supplies values,
labels, validation, permissions, and save operations. Import these families from `@mechane-ai/elements/forms`. Calendar
controls use `/forms/dates`.

Use `Checkbox` for submitted choices, `Switch` for immediately applied settings, and `RadioGroup` for exclusive form
choices. `ToggleGroup` represents pressed view or formatting controls. Compose their public parts inside `Field.Label`.
Each controlled value requires its change callback. An uncontrolled default cannot accompany a controlled value.
Checkbox, Switch, RadioGroup, and NumberField also support an explicit controlled `readOnly` mode.

`Combobox` adds search to a finite option domain. Its single and multiple modes keep the selected record type in
callbacks. Object values need stable identity and label/value conversion. Its `List` render callback can declare the
record type explicitly. Use `Select` when search adds no value. For remote search, pass the application’s query and
`filteredItems`; the component must not mistake one returned page for all possible options. Display pending and failed
searches through `Status`, while preserving the selected values.

`Fieldset` names a group of related fields. `InputGroup` places prefixes, suffixes, or actions beside its `Input`. Keep
editable content in the input, and make noneditable prefixes clear in the associated description. `NumberField` supports
precise entry and increment/decrement buttons. `Slider` supports a bounded value or range with one labelled thumb per
bound. Both require a locale so formatting matches between server and browser.

`FilePicker` preserves the native file input and change event. It does not upload or read files. The application owns
accepted content, validation, storage, and progress. Use `Field.Description` for supported formats and limits.

The [selection stories](../packages/browser/elements/packages/forms/src/selection.stories.tsx),
[searchable selection stories](../packages/browser/elements/packages/forms/src/combobox.stories.tsx), and
[composed form stories](../packages/browser/elements/packages/forms/src/form-controls.stories.tsx) show the maintained
APIs. They use synthetic values and perform no requests.

## Color scheme

Import `themeProps` from `@mechane-ai/elements/theme`. Spread `themeProps.light` or `themeProps.dark` onto the document
root. Components share the same spacing and type scale in both modes. The dark theme replaces the semantic tokens
through StyleX and sets the native control color scheme. Light token values work without a theme class. The application
owns preference persistence. Apply a theme to the document root so portaled menus, dialogs, and tooltips inherit it. A
local themed wrapper is appropriate for an isolated preview, not a portal owner.

StyleX consumers may still override roles through `@mechane-ai/elements/tokens.stylex`. Ordinary React consumers only
need the package stylesheet and `themeProps`; they need no StyleX compiler or theme provider.

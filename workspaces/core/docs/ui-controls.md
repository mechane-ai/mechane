# Form controls

The supported controls use Base UI for selection, number entry, and focus behavior. The application supplies values,
labels, validation, permissions, and save operations. Import these families from `@mechane-ai/elements/forms`. Calendar
controls use `/forms/dates`.

Use `Checkbox` for submitted choices, `Switch` for immediately applied settings, and `RadioGroup` for exclusive form
choices. `ToggleGroup` represents pressed view or formatting controls. Compose their public parts inside `Field.Label`.
Each controlled value requires its change callback. An uncontrolled default cannot accompany a controlled value.
Checkbox, Switch, RadioGroup, and NumberField also support an explicit controlled `readOnly` mode.

Use `SelectControl` for one choice from labeled string values. Supply `items` once, the controlled `value`, and
`onValueChange`. Its `label` names the trigger without adding a visible label row. An enclosing `Field` still supplies
visible labels, descriptions and validation. `name`, `form`, `required` and `inputRef` connect the hidden form input;
`ref`, native events and accessibility references belong to the trigger. `readOnly` can omit the change callback.
Opening, focusing or replacing the choices never selects a different supplied value.

```tsx
<SelectControl label="Dataset" items={datasets} value={dataset} onValueChange={setDataset} />
```

The complete [select examples](../packages/browser/elements/packages/forms/src/select.stories.tsx) show labeled forms,
disabled options, empty selection, changing options and compact density. Use compound `Select` for custom trigger
content, rich option layouts, object values or multiple selection. Both compositions use the same selection
implementation and control geometry. Density changes the trigger; popup options retain standard targets.

`Combobox` adds search to a finite option domain. Its single and multiple modes keep the selected record type in
callbacks. Object values need stable identity and label/value conversion. Its `List` render callback can declare the
record type explicitly. For remote search, pass the application’s query and `filteredItems`; the component must not
mistake one returned page for all possible options. Display pending and failed searches through `Status`, while
preserving the selected values.

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

## Dates and reporting periods

Import date controls from `@mechane-ai/elements/forms/dates`.

| Need                                        | Control            |
| ------------------------------------------- | ------------------ |
| One civil date                              | `DatePicker`       |
| An inclusive day interval                   | `DateRangePicker`  |
| One billing month                           | `MonthPicker`      |
| An inclusive interval of billing months     | `MonthRangePicker` |
| An inline calendar with immediate selection | `Calendar`         |

The pickers keep an uncommitted draft in their popup. Apply commits one complete value. Cancel, Escape and outside
dismissal discard edits. A supplied preset commits its complete interval immediately. `CalendarRange` permits a partial
inline selection; `DateRange` and `MonthRange` require both endpoints. Use `isClearable={false}` for required query
periods.

Supply locale, time zone, today, initial month, bounds and preset values explicitly. Civil values retain their calendar
components across time zones. The application converts inclusive dates to its API's timestamps or exclusive bounds.
Pickers perform no requests, read no clock and persist no view state. `validateRange` returns a visible message and
disables Apply for unsupported intervals; it does not change a selection into a different interval.

The same entry exports `parseCalendarDate`, `parseCalendarMonth`, `serializeCalendarDate`, `serializeCalendarMonth`,
`addCalendarDays` and `addCalendarMonths`. Parsing accepts canonical `YYYY-MM-DD` or `YYYY-MM` strings and returns
`undefined` for invalid input. Serialization and arithmetic throw `RangeError` for invalid values or results outside
Gregorian years 1–9999. Arithmetic requires integer offsets and returns a new calendar value. Day arithmetic crosses
calendar boundaries independently of daylight-saving changes; month arithmetic operates on a month without day clamping.
These helpers read no clock or reporting time zone. The application retains its presets, coverage limits and conversion
to API timestamps or exclusive bounds. Their [source](../packages/browser/elements/packages/forms/src/dates/civil.ts)
owns the supported signatures.

Type values in the labeled fields or choose them from the calendar. Month selection uses a twelve-month grid with arrow
keys, Home/End and Page Up/Down. Choose compact density only for a scoped report trigger; popup fields, calendar targets
and actions keep their standard density. The
[date stories](../packages/browser/elements/packages/forms/src/dates/calendar.stories.tsx) show the family, bounds,
validation, committed values and required periods.

## Color scheme

Import `themeProps` from `@mechane-ai/elements/theme`. Spread `themeProps.light` or `themeProps.dark` onto the document
root. Components share the same spacing and type scale in both modes. The dark theme replaces the semantic tokens
through StyleX and sets the native control color scheme. Light token values work without a theme class. The application
owns preference persistence. Apply a theme to the document root so portaled menus, dialogs, and tooltips inherit it. A
local themed wrapper is appropriate for an isolated preview, not a portal owner.

StyleX consumers may still override roles through `@mechane-ai/elements/tokens.stylex`. Ordinary React consumers only
need the package stylesheet and `themeProps`; they need no StyleX compiler or theme provider.

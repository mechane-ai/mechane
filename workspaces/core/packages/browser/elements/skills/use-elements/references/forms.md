# Forms

Import controls from `@mechane-ai/elements/forms` and date controls from `/forms/dates`. The application supplies
values, labels, validation, permissions and the save.

## Choose the control

| The reader                                        | Use                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Types a line or several lines                     | `Input`, `Textarea`                                                |
| Types a number with steps, or drags a bound       | `NumberField`, `Slider`, both with a `locale`                      |
| Ticks a choice that a later save submits          | `Checkbox`                                                         |
| Turns on a setting that applies at once           | `Switch`                                                           |
| Picks one value in a form                         | `RadioGroup`                                                       |
| Switches between a few views, one always checked  | `SegmentedControl`                                                 |
| Presses independent options, such as formatting   | `ToggleGroup`                                                      |
| Picks one of several labeled strings              | `SelectControl`                                                    |
| Needs rich options, object values or many choices | compound `Select`                                                  |
| Searches a finite or remote set of options        | `Combobox`                                                         |
| Chooses, drops or pastes files                    | `FilePicker`                                                       |
| Picks a date, a day range, a month or months      | `DatePicker`, `DateRangePicker`, `MonthPicker`, `MonthRangePicker` |

```tsx
<SegmentedControl.Root value={view} onValueChange={setView} aria-label="View">
  <SegmentedControl.Item value="table">Table</SegmentedControl.Item>
  <SegmentedControl.Item value="chart">Chart</SegmentedControl.Item>
</SegmentedControl.Root>
```

Use `Menu` from `/overlays` for commands and immediate choices, not for a form value.

## Label and validate

`Field.Root` associates `Field.Label`, `Field.Description` and `Field.Error` with its control. Validation text stays
beside its field. Use `Fieldset` to name a group of fields, and `InputGroup` for a prefix, suffix or action beside an
`Input`.

```tsx
<Field.Root name="reason" invalid={isInvalid}>
  <Field.Label>Reason</Field.Label>
  <Input required value={reason} onValueChange={setReason} />
  <Field.Error match={isInvalid}>Enter a reason.</Field.Error>
</Field.Root>
```

- `Input` and `Textarea` report edits through `onValueChange`, from a person or an agent.
- Set `isSensitive` on `Field.Root` for credentials and private drafts. The value, label and validation then stay out of
  what an agent can read. Password inputs do this already.
- A disabled control is unavailable. A read-only value stays selectable.

## Save

Put the submit row in `FormActions`. Pass `isPending` to the button while the request runs; it keeps focus and prevents
a second activation. Show the outcome with `FormStatus` in its pending, error or success state.

For a change that is hard to undo, use `ConfirmButton` with a `confirmation` sentence that names the record, usually
inside an `AlertDialog`. Keep the safe action first, keep the dialog open with an inline error until the server
acknowledges success, and keep the draft when the save fails. The **Consequential form** recipe shows the whole flow.

## Files

`FilePicker` takes `accept`, `multiple`, `maxFiles`, `maxSize` and `minSize`, and reports
`onValueChange(files, details)`. It lists the chosen files and says why one was refused. It never uploads or reads a
file. The application owns storage and progress, and the server still enforces every limit. State the formats and limits
in `Field.Description`.

## Dates

Dates are civil values, `{ year, month, day }` with one-based months. Supply the locale, time zone, today, bounds and
presets explicitly; a picker reads no clock. The app converts an inclusive range to its API's timestamps.

- The day pickers take a typed date, one field per unit. Digits fill a unit and the arrow keys step it.
- A picker keeps a draft in its popup. Apply commits one complete value. Escape and Cancel discard it.
- Use `isClearable={false}` for a required reporting period, and `validateRange` to refuse an unsupported interval.
- `parseCalendarDate`, `serializeCalendarDate`, `addCalendarDays` and their month forms convert and step values.
- `Calendar` is an inline calendar with immediate selection. `EventMonth` is a month grid of the app's own events.

## Settings pages

`SettingsSection` groups settings and `SettingsRow` binds a real `controlId` to its label and description. Settings that
apply at once use `Switch` or a select. Settings saved together use a form with `FormActions`.

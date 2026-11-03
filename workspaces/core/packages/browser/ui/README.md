# @mechane/ui

Accessible primitives, theme tokens, and small charts independent of Mechane resources.

Controls, forms, typography, surfaces, tables, and layout have separate modules. The frame owns the collapsible sidebar
and mobile drawer; screens supply toolbar actions. Lists fill the main surface, and `DetailPage` centers resource
details and forms. Frame dimensions and colors live in the shared tokens. Base UI owns select, tab, and dialog behavior;
StyleX owns shared appearance; visx scales the selectable timeline. Charts accept presentation values, never transport
or storage records. See the [Console guide](../../../docs/console.md) for the package boundaries and browser checks.

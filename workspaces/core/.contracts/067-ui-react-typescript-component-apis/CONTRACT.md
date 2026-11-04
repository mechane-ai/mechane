---
name: ui-react-typescript-component-apis
paths: ["packages/browser/ui/packages/**/src/**"]
message: Encode supported component use in public prop types so unsupported combinations fail to compile.
---

## Rules

Treat each exported prop type as the component's supported surface, and make a combination that should not ship fail to compile.
Model mutually exclusive modes, such as controlled and uncontrolled state, as a discriminated union of prop types.
Type the props that belong to another mode as optional `never` in each union member.
Require the change callback in controlled mode.
Type visual choices such as `size`, `tone`, and `density` as string-literal unions, not open `string`.
Type catalogued choices such as icon names as a finite union of stable names, and keep the underlying library's component names private.
Make a prop required when the component cannot render correctly without it, such as the accessible label of an icon-only button or an empty-state message.
Allow an empty prop value only where the component renders a gap or missing state for it, and type it as `code-typescript-effect-absent-values` requires.
Type content that the component renders verbatim, such as code or a label, as `string` rather than `ReactNode` or a pre-rendered element tree.
Make collection components generic over the record type, so their callbacks receive the caller's record type.

Export the package's own prop and value types, and keep third-party component, chart, positioning, and animation library types out of exported props.
Keep data-layer types, such as query builders, database collections, and transport state, out of exported props.

Guard a consequential rejected combination with a compile-time assertion such as `@ts-expect-error` rather than prose alone.

## Checks

Run the TypeScript compiler over the component package and its consumers.
Write the rejected combinations for a changed union, such as mixed controlled and uncontrolled props or a missing change callback, and confirm each fails to compile.
Review exported prop types for third-party library types, data-layer types, and open `string` where a finite set applies.

## Local adaptations

The public surface is the implemented component families exported by `@mechane-ai/ui` and its declared subpaths.
Ordinary React composition and inferred framework return types remain allowed under contract 113.

The upstream clause "Export the package's own prop and value types, and keep third-party component, chart,
positioning, and animation library types out of exported props." is replaced by this boundary: public props may
derive from the selected Base UI primitives and React native attributes. Keep query, database, transport, and visx
implementation types private. Preserve upstream refs, event details, and generic record types.

The upstream clause "Type catalogued choices such as icon names as a finite union of stable names, and keep the
underlying library's component names private." does not require an icon-name registry. Use the adopted Lucide
vocabulary and shared sizing. Add a finite name registry only when a feature accepts icon names as data.

The upstream clause "Allow an empty prop value only where the component renders a gap or missing state for it,
and type it as `code-typescript-effect-absent-values` requires." uses ordinary React `null` and `undefined` here.
That Effect contract is not adopted for browser props.

Mechane-owned interactive controls reject mixed controlled/default inputs and require the controlled change callback.
An explicit upstream read-only mode may omit the callback. Native inputs retain their native events, and Base UI
controls retain their typed change callbacks.

The upstream clause "Guard a consequential rejected combination with a compile-time assertion such as
`@ts-expect-error` rather than prose alone." is subject to repository test curation. Exercise rejected combinations
with temporary compiler probes. Retain an assertion only for a consequential coverage gap under the same policy.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

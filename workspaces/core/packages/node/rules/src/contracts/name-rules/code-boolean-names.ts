import { BOOLEAN_PREFIXES } from '@mechane/records';
import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * The prefixes that start a boolean's name: a predicate's, which the protocol's wire keys drop, and an option's. The
 * protocol declares the predicate prefixes because its wire keys need them at run time.
 */
const VALUES = {
  predicatePrefixes: BOOLEAN_PREFIXES,
  optionPrefixes: ['include', 'allow', 'skip', 'keep', 'use', 'show', 'hide'],
  nativeAttributes: [
    'autoFocus',
    'checked',
    'defaultChecked',
    'defaultOpen',
    'disabled',
    'hidden',
    'inert',
    'indeterminate',
    'modal',
    'multiple',
    'open',
    'readOnly',
    'required',
  ],
  keyboardModifiers: ['mod', 'ctrl', 'alt', 'shift', 'meta'],
  externalProperties: ['self_grading'],
} as const;

const EXAMPLES = {
  violation: [
    'const paid = true;',
    'type Mech = { readonly ready: boolean };',
    'type ButtonProps = { readonly busy: boolean };',
    'const [pending, setPending] = useState(false);',
    'const disabled = true;',
    'type PanelProps = { readonly busy: boolean | undefined };',
    'type PlaceholderProps = { readonly icon: true };',
    'function useNavigation(focusOnNavigation = true) {}',
    "type OwnedFlags = { readonly 'no_bundle': true };",
    'const self_grading = true;',
  ],
  allowed: [
    'const isPaid = true;',
    'type ButtonProps = { readonly disabled: boolean; readonly isBusy: boolean };',
    'type StateProperties = { readonly onChange: (checked: boolean) => void };',
    'type CommandShortcut = { readonly ctrl: boolean };',
    'const [isPending, setIsPending] = useState(false);',
    'type PollingOptions = { readonly interval: number | false };',
    'function useNavigation(shouldFocusOnNavigation = true) {}',
    'function Control({ disabled = false }: ControlProps) {}',
    'type BuiltBundle = { readonly no_bundle: true };',
    'const suite = { self_grading: true };',
  ],
} as const;

/** What enforces `code-boolean-names`: the prefixes the boolean-names rule reads. */
export const codeBooleanNames = {
  values: VALUES,
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'boolean-names',
      ...EXAMPLES,
      maxSuppressions: 1,
      behavior: FixBehavior.BindingNames,
      standard: 'NM-07',
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      ...EXAMPLES,
      name: 'boolean-names-tsx',
      behavior: FixBehavior.BindingNames,
      standard: 'NM-07',
    },
  ],
} as const satisfies ContractEnforcement;

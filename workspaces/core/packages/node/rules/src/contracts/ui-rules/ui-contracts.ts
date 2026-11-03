import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { uiAsyncReadStates } from './ui-async-read-states.ts';
import { uiComponentUsageGuidance } from './ui-component-usage-guidance.ts';
import { uiControlAccessibility } from './ui-control-accessibility.ts';
import { uiDesignTokens } from './ui-design-tokens.ts';
import { uiDeterministicDisplayValues } from './ui-deterministic-display-values.ts';
import { uiMotionLifecycle } from './ui-motion-lifecycle.ts';
import { uiPresentationBoundaries } from './ui-presentation-boundaries.ts';
import { uiPresentationState } from './ui-presentation-state.ts';
import { uiReactInteractionOwnership } from './ui-react-interaction-ownership.ts';
import { uiReactTypescriptComponentApis } from './ui-react-typescript-component-apis.ts';
import { uiStorybookComponentChecks } from './ui-storybook-component-checks.ts';

/** Each adopted UI contract has one enforcement owner, including requirements established by review. */
export const UI_CONTRACTS = {
  'ui-presentation-boundaries': uiPresentationBoundaries,
  'ui-design-tokens': uiDesignTokens,
  'ui-react-typescript-component-apis': uiReactTypescriptComponentApis,
  'ui-control-accessibility': uiControlAccessibility,
  'ui-react-interaction-ownership': uiReactInteractionOwnership,
  'ui-presentation-state': uiPresentationState,
  'ui-async-read-states': uiAsyncReadStates,
  'ui-deterministic-display-values': uiDeterministicDisplayValues,
  'ui-motion-lifecycle': uiMotionLifecycle,
  'ui-component-usage-guidance': uiComponentUsageGuidance,
  'ui-storybook-component-checks': uiStorybookComponentChecks,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;

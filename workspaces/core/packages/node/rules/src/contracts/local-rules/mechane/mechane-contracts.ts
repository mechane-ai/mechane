import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeStyle } from './code-style.ts';
import { consoleBoundaries } from './console-boundaries.ts';
import { consoleCacheLifecycle } from './console-cache-lifecycle.ts';
import { installationOwnership } from './installation-ownership.ts';
import { packageLayers } from './package-layers.ts';
import { ruleRegistry } from './rule-registry.ts';
import { uiAnalyticalGraphics } from './ui-analytical-graphics.ts';
import { uiContentRendering } from './ui-content-rendering.ts';
import { uiConversationState } from './ui-conversation-state.ts';
import { uiStylexComposition } from './ui-stylex-composition.ts';
import { uiWaterfallCharts } from './ui-waterfall-charts.ts';

/** The registry's entry for each contract of Mechane's own section, in the order of their folders. */
export const MECHANE_CONTRACTS = {
  'package-layers': packageLayers,
  'rule-registry': ruleRegistry,
  'code-style': codeStyle,
  'installation-ownership': installationOwnership,
  'console-boundaries': consoleBoundaries,
  'ui-stylex-composition': uiStylexComposition,
  'ui-waterfall-charts': uiWaterfallCharts,
  'ui-content-rendering': uiContentRendering,
  'ui-conversation-state': uiConversationState,
  'ui-analytical-graphics': uiAnalyticalGraphics,
  'console-cache-lifecycle': consoleCacheLifecycle,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;

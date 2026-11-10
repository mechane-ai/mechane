import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import {
  browserControl,
  browserEvidence,
  developerEnvironments,
  evidenceExport,
  executionAccess,
  managedProcesses,
  modelCaching,
  threadContinuations,
} from './agent-runtime.ts';
import { channelDelivery } from './channel-delivery.ts';
import { codeStyle } from './code-style.ts';
import { consoleBoundaries } from './console-boundaries.ts';
import { consoleCacheLifecycle } from './console-cache-lifecycle.ts';
import { installationOwnership } from './installation-ownership.ts';
import { nativeWorkflowRuntime } from './native-workflow-runtime.ts';
import { packageLayers } from './package-layers.ts';
import { ruleRegistry } from './rule-registry.ts';
import { structuredPresentation } from './structured-presentation.ts';
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
  'execution-access': executionAccess,
  'thread-continuations': threadContinuations,
  'developer-environments': developerEnvironments,
  'model-caching': modelCaching,
  'native-workflow-runtime': nativeWorkflowRuntime,
  'channel-delivery': channelDelivery,
  'structured-presentation': structuredPresentation,
  'managed-processes': managedProcesses,
  'browser-control': browserControl,
  'browser-evidence': browserEvidence,
  'evidence-export': evidenceExport,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;

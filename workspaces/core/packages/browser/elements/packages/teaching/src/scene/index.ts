/**
 * Diagrams with identity. A `Scene` places nodes, wires, notes, plane marks, cards, cells and tokens in a data box on
 * the plot kernel; change their props and they ease to the new state. New parts build on `useSceneObject`.
 */
export type { SceneProps } from './scene.tsx';
export { Scene } from './scene.tsx';
export type { SceneNodeProps } from './scene-node.tsx';
export { SceneNode } from './scene-node.tsx';
export type { SceneWireProps, SceneWireShape, SceneWireTextSide } from './scene-wire.tsx';
export { SceneWire } from './scene-wire.tsx';
export type { SceneGroupProps } from './scene-group.tsx';
export { SceneGroup } from './scene-group.tsx';
export type { SceneBracketProps, SceneBracketSide } from './scene-bracket.tsx';
export { SceneBracket } from './scene-bracket.tsx';
export type { SceneCalloutProps, SceneCalloutSide } from './scene-callout.tsx';
export { SceneCallout } from './scene-callout.tsx';
export type { SceneHighlightProps } from './scene-highlight.tsx';
export { SceneHighlight } from './scene-highlight.tsx';
export type { SceneCustomProps, SceneDrawing } from './scene-custom.tsx';
export { SceneCustom } from './scene-custom.tsx';
export type { SceneLayerName } from './scene-layer.tsx';
export { SceneLayer, SceneOutside } from './scene-layer.tsx';
export type { SceneContextValue, SceneFollowed, SceneObjectInput, SceneObjectState } from './scene-context.ts';
export { useSceneContext, useSceneFrames, useSceneObject } from './scene-context.ts';
export type { SceneDelay, SceneStagger, SceneStaggerPlace } from './scene-stagger.ts';
export { sceneStaggers } from './scene-stagger.ts';
export type {
  SceneDataPoint,
  SceneFrame,
  SceneMargins,
  SceneOffset,
  ScenePixel,
  ScenePosition,
  SceneRect,
  SceneShape,
  SceneSize,
  SceneSizeName,
  SceneView,
} from './scene-geometry.ts';
export {
  edgePoint,
  nodeBox,
  padRect,
  rectCenter,
  rectsOverlap,
  sceneCircleSizes,
  sceneNodeSizes,
  sidePoint,
  unionRect,
} from './scene-geometry.ts';
export { useObstacle } from './scene-obstacles.ts';
export type { SceneFrameKey, SceneFrameValues, SceneMember, SceneRegistry, SceneTrack } from './scene-registry.ts';
export { sceneStore } from './scene-registry.ts';
export type { SceneOutlineState } from './scene-style.ts';
export { sceneContextColor, sceneOutlines } from './scene-style.ts';
export type { SceneLabels } from './scene-validate.ts';
export { fillLabel, sceneLabels, sceneLimits } from './scene-validate.ts';

export type { SceneAxesProps, SceneAxis } from './plane/scene-axes.tsx';
export { SceneAxes } from './plane/scene-axes.tsx';
export type { SceneCurveProps } from './plane/scene-curve.tsx';
export { SceneCurve } from './plane/scene-curve.tsx';
export type { ScenePointAlong, ScenePointMoveDetails, ScenePointProps, ScenePointSets } from './plane/scene-point.tsx';
export { ScenePoint } from './plane/scene-point.tsx';
export type { SceneProjectionProps } from './plane/scene-projection.tsx';
export { SceneProjection } from './plane/scene-projection.tsx';
export type { SceneRegionProps } from './plane/scene-region.tsx';
export { SceneRegion } from './plane/scene-region.tsx';
export type { SceneRuleProps } from './plane/scene-rule.tsx';
export { SceneRule } from './plane/scene-rule.tsx';
export type { SceneVectorProps } from './plane/scene-vector.tsx';
export { SceneVector } from './plane/scene-vector.tsx';
export type { ScenePlaneLabels } from './plane/plane-labels.ts';
export { planeLabels } from './plane/plane-labels.ts';
export type { SceneCurveResolution, ScenePlaneThickness } from './plane/plane-math.ts';
export { curveResolutions, planeLimits, planeThicknesses } from './plane/plane-math.ts';

export type { CardRank, CardSuit, SceneCardLabels, SceneCardProps } from './shapes/scene-card.tsx';
export { cardRanks, cardSuits, SceneCard, sceneCardLabels, suitTones } from './shapes/scene-card.tsx';
export type { SceneStackLabels, SceneStackProps } from './shapes/scene-stack.tsx';
export { SceneStack, sceneStackLabels } from './shapes/scene-stack.tsx';
export type { SceneSlotProps } from './shapes/scene-slot.tsx';
export { SceneSlot } from './shapes/scene-slot.tsx';
export type {
  SceneCardSizeName,
  StackBounds,
  StackGapName,
  StackLayout,
  StackPlace,
  StackShape,
} from './shapes/stack-layout.ts';
export { sceneCardSizes, stackBounds, stackGaps, stackPlace } from './shapes/stack-layout.ts';
export type { SceneCellsLabels, SceneCellsProps } from './shapes/scene-cells.tsx';
export { SceneCells, sceneCellsLabels } from './shapes/scene-cells.tsx';
export type { SceneCellInput, SceneCellsDirection, SceneCellSizeName, SceneCellValues } from './shapes/cell-grid.ts';
export { cellGap, sceneCellSizes } from './shapes/cell-grid.ts';
export type { SceneTokenLabels, SceneTokenProps } from './shapes/scene-token.tsx';
export { SceneToken, sceneTokenLabels, tokenPercent } from './shapes/scene-token.tsx';
export type { SceneTokenItem, SceneTokensProps } from './shapes/scene-tokens.tsx';
export { SceneTokens } from './shapes/scene-tokens.tsx';
export type { TokenFlow, TokenGapName } from './shapes/token-layout.ts';
export { tokenBox, tokenFlow, tokenGaps } from './shapes/token-layout.ts';

export type { LessonFlowProps, SceneFlowLabels, SceneFlowProps } from './flow/scene-flow.tsx';
export { flowNodeSize, LessonFlow, SceneFlow, sceneFlowLabels } from './flow/scene-flow.tsx';
export type { FlowDirection, FlowPlan, FlowSlot } from './flow/flow-layout.ts';
export { flowPlan, flowPositions } from './flow/flow-layout.ts';
export type { MorphLabels, MorphScopeProps } from './morph/morph-scope.tsx';
export { morphLabels, MorphScope } from './morph/morph-scope.tsx';

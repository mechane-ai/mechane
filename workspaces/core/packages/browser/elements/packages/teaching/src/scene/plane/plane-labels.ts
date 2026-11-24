/** The words the plane parts show that are not the author's content. Placeholders in braces are filled in. */
export type ScenePlaneLabels = {
  /** `{id}` names the curve. */
  readonly curveSource: string;
  /** `{id}` names the curve, `{limit}` is the most points one curve takes. */
  readonly curveTooMany: string;
  /** `{id}` names the curve. */
  readonly curveOrder: string;
  /** `{id}` names the curve and `{x}` the position where the function gave a value that is not a number. */
  readonly curveValue: string;
  /** `{id}` names the point. */
  readonly pointLabel: string;
  /** `{id}` names the point that sets lesson params outside any `Lesson`. */
  readonly pointOutsideLesson: string;
  /** `{id}` names the point, `{name}` the param and `{lesson}` the lesson that does not declare it as a number. */
  readonly pointParam: string;
  /** Added after a movable point's label in the readout. */
  readonly pointMovable: string;
  /** `{id}` names the region. */
  readonly regionShape: string;
  /** `{id}` names the rule. */
  readonly ruleAxis: string;
  /** `{id}` names the projection. */
  readonly projectionSource: string;
  /** `{kind}` and `{id}` name the part whose value is not a finite number. */
  readonly notFinite: string;
};

/** The plain English defaults of `ScenePlaneLabels`. */
export const planeLabels = {
  curveSource: 'The curve "{id}" needs `points` or `of`, and not both.',
  curveTooMany: 'The curve "{id}" takes at most {limit} points. Pass fewer, or use `of`.',
  curveOrder: 'The curve "{id}" needs at least two points with strictly increasing x.',
  curveValue: 'The curve "{id}" gives a value that is not a number at x = {x}.',
  pointLabel: 'The point "{id}" can be moved, so it needs a `label` for the readout.',
  pointOutsideLesson: 'The point "{id}" sets lesson params, so it must be inside a Lesson.',
  pointParam: 'The point "{id}" sets "{name}", which lesson "{lesson}" does not declare as a number param.',
  pointMovable: ' Use the arrow keys to move it.',
  regionShape: 'The region "{id}" needs one of `between`, `above`, `below` or `points`.',
  ruleAxis: 'The rule "{id}" needs `x` or `y`, and not both.',
  projectionSource: 'The projection "{id}" needs `of` or `at`, and not both.',
  notFinite: 'The {kind} "{id}" has a value that is not a finite number.',
} as const satisfies ScenePlaneLabels;

import type { NumericDomain } from '../../../charts/src/index.ts';
import { scaleDomainError } from '../../../charts/src/plot/index.ts';
import type { SceneFrame } from './scene-geometry.ts';
import type { SceneMember, SceneMembers } from './scene-registry.ts';

/** The words a scene shows that are not the author's content. Placeholders in braces are filled in. */
export type SceneLabels = {
  /** What the arrow keys step through, for the plot's accessible name. */
  readonly objects: string;
  /** The header of the exact-value table. */
  readonly objectColumn: string;
  /**
   * Ends the plot's accessible name when a press acts, with `onSelectedChange`. Name the action, such as "Press Enter
   * to turn the card over."
   */
  readonly press: string;
  readonly missingLocale: string;
  readonly invalidBox: string;
  readonly invalidAspect: string;
  /** `{limit}` is the most objects a scene draws. */
  readonly tooMany: string;
  /** `{id}` is the shared id. */
  readonly duplicateId: string;
  /** `{kind}` and `{id}` name the object, `{target}` the id it names. */
  readonly unknownId: string;
  /** `{kind}` and `{id}` name the object. */
  readonly outsideBox: string;
  /** `{id}` is the id the focus names. */
  readonly unknownFocus: string;
  /** `{id}` names the wire, `{weight}` its weight and `{limit}` the scene's `weightMax`. */
  readonly weightOutside: string;
  /** `{part}` names a part rendered outside any scene. */
  readonly outside: string;
};

/** The plain English defaults of `SceneLabels`. */
export const sceneLabels = {
  objects: 'diagram parts',
  objectColumn: 'Part',
  press: 'Press Enter or Space to activate a part.',
  missingLocale: 'This scene needs a locale. Pass `locale`, or place it inside a Lesson.',
  invalidBox: 'The scene box needs two finite, increasing values on each axis.',
  invalidAspect: 'The scene aspect must be a positive, finite ratio of width to height.',
  tooMany: 'This scene draws at most {limit} objects. Show fewer, or group them.',
  duplicateId: 'Two scene objects share the id "{id}". Give each its own id.',
  unknownId: 'The {kind} "{id}" attaches to "{target}", which no object in this scene has.',
  outsideBox: 'The {kind} "{id}" sits outside the scene box.',
  unknownFocus: 'The focus names "{id}", which no object in this scene has.',
  weightOutside: 'The wire "{id}" has weight {weight}, outside the scene\'s weight limit of plus or minus {limit}.',
  outside: '{part} must be inside a Scene.',
} as const satisfies SceneLabels;

/** The most objects one scene draws. Larger input shows an error; the author groups or splits the diagram. */
export const sceneLimits = { objects: 1200 } as const;

/** A label with its `{name}` placeholders filled in. */
export function fillLabel(template: string, values: Readonly<Record<string, string>>): string {
  return template.replaceAll(/\{(\w+)\}/gu, (whole, name: string) => values[name] ?? whole);
}

type Box = { readonly x: NumericDomain; readonly y: NumericDomain };

/** Why the scene's own props cannot be drawn, or undefined when they can. */
export function sceneBoxError({
  box,
  aspect,
  labels,
}: {
  readonly box: Box;
  readonly aspect: number | undefined;
  readonly labels: SceneLabels;
}): string | undefined {
  if (scaleDomainError(box.x) !== undefined || scaleDomainError(box.y) !== undefined) {
    return labels.invalidBox;
  }

  const isBadAspect = aspect !== undefined && (!Number.isFinite(aspect) || aspect <= 0);

  return isBadAspect ? labels.invalidAspect : undefined;
}

function isOutside(frame: SceneFrame | undefined, box: Box): boolean {
  if (frame === undefined) {
    return false;
  }

  const isNumeric = Number.isFinite(frame.x) && Number.isFinite(frame.y);
  const isOutsideX = frame.x < box.x[0] || frame.x > box.x[1];
  const isOutsideY = frame.y < box.y[0] || frame.y > box.y[1];

  return !isNumeric || isOutsideX || isOutsideY;
}

function memberError({
  member,
  ids,
  box,
  labels,
}: {
  readonly member: SceneMember;
  readonly ids: ReadonlySet<string>;
  readonly box: Box;
  readonly labels: SceneLabels;
}): string | undefined {
  if (member.problem !== undefined) {
    return member.problem;
  }

  const missing = member.attaches.find((target) => !ids.has(target));

  if (missing !== undefined) {
    return fillLabel(labels.unknownId, { kind: member.kind, id: member.id, target: missing });
  }

  return isOutside(member.frame, box) ? fillLabel(labels.outsideBox, { kind: member.kind, id: member.id }) : undefined;
}

/** The first problem among the registered objects, as a sentence naming the object, or undefined. */
export function membersError({
  members,
  focus,
  box,
  labels,
}: {
  readonly members: SceneMembers;
  readonly focus: ReadonlyArray<string>;
  readonly box: Box;
  readonly labels: SceneLabels;
}): string | undefined {
  if (members.list.length > sceneLimits.objects) {
    return fillLabel(labels.tooMany, { limit: String(sceneLimits.objects) });
  }

  const [duplicate] = members.duplicates;

  if (duplicate !== undefined) {
    return fillLabel(labels.duplicateId, { id: duplicate });
  }

  const ids = new Set(members.list.map((member) => member.id));

  for (const member of members.list) {
    const error = memberError({ member, ids, box, labels });

    if (error !== undefined) {
      return error;
    }
  }

  const unknown = ids.size === 0 ? undefined : focus.find((id) => !ids.has(id));

  return unknown === undefined ? undefined : fillLabel(labels.unknownFocus, { id: unknown });
}

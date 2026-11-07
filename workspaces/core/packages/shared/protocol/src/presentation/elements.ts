import { z } from 'zod';
import { PRESENTATION_COMPONENTS } from './components.ts';
import { PRESENTATION_LIMITS } from './limits.ts';

const ElementKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
const Children = z.array(ElementKey).max(PRESENTATION_LIMITS.elements);

type ComponentName = keyof typeof PRESENTATION_COMPONENTS;

type ElementSchemaInput<Name extends ComponentName, Props extends z.ZodType> = {
  readonly name: Name;
  readonly props: Props;
};

type ElementSchemaShape<Name extends ComponentName, Props extends z.ZodType> = {
  readonly type: z.ZodLiteral<Name>;
  readonly props: Props;
  readonly children: typeof Children;
};

type ElementSchema<Name extends ComponentName, Props extends z.ZodType> = z.ZodObject<
  ElementSchemaShape<Name, Props>,
  z.core.$strict
>;

function createElementSchema<Name extends ComponentName, Props extends z.ZodType>({
  name,
  props,
}: ElementSchemaInput<Name, Props>): ElementSchema<Name, Props> {
  return z.strictObject({ type: z.literal(name), props, children: Children });
}

export const PresentationElement = z.discriminatedUnion('type', [
  createElementSchema({ name: 'Card', props: PRESENTATION_COMPONENTS.Card.props }),
  createElementSchema({ name: 'Section', props: PRESENTATION_COMPONENTS.Section.props }),
  createElementSchema({ name: 'Text', props: PRESENTATION_COMPONENTS.Text.props }),
  createElementSchema({ name: 'Fields', props: PRESENTATION_COMPONENTS.Fields.props }),
  createElementSchema({ name: 'Field', props: PRESENTATION_COMPONENTS.Field.props }),
  createElementSchema({ name: 'Table', props: PRESENTATION_COMPONENTS.Table.props }),
  createElementSchema({ name: 'Chart', props: PRESENTATION_COMPONENTS.Chart.props }),
  createElementSchema({ name: 'Divider', props: PRESENTATION_COMPONENTS.Divider.props }),
  createElementSchema({ name: 'Actions', props: PRESENTATION_COMPONENTS.Actions.props }),
  createElementSchema({ name: 'LinkButton', props: PRESENTATION_COMPONENTS.LinkButton.props }),
]);

export type PresentationElement = z.infer<typeof PresentationElement>;

export const StaticPresentationSpecification = z.strictObject({
  root: ElementKey,
  elements: z.record(ElementKey, PresentationElement),
});

export type StaticPresentationSpecification = z.infer<typeof StaticPresentationSpecification>;

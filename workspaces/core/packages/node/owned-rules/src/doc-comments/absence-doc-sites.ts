import type { Site } from '@mechane/checks-kernel';
import { lineAt } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Option } from 'effect';
import { Visitor } from 'oxc-parser';
import type { TSPropertySignature, VisitorObject } from 'oxc-parser';
import { DocRule } from './constants.ts';
import { declaringExports } from './declaring-exports.ts';
import type { AttachedDocs } from './types.ts';

/** A schema member that leaves a field's key optional or its value nullable in the Encoded form, or an `Option`. */
const ABSENCE_SCHEMA =
  /\bSchema\.(optional|optionalKey|Option|OptionFrom\w+|NullOr|NullishOr|UndefinedOr|withDecodingDefault\w*)\b/;

/** A type that may hold nothing: an `Option`, or a union with `null` or `undefined`. */
const ABSENCE_TYPE = /\bOption\.Option<|\bnull\b|\bundefined\b/;

type AbsenceDocSitesInput = { readonly source: ParsedSource; readonly attached: AttachedDocs };

/** A field that may be absent: where it starts, and its key as the source writes it. */
type AbsentField = { readonly start: number; readonly key: string };

type SchemaTextInput = { readonly text: string };

/**
 * Each field that may be absent and has no doc comment above it. Such a property's type is optional, nullable or an
 * `Option`, in any type. Such an object field of a declaring export's schema leaves it out, empty or an `Option`.
 */
export function absenceDocSites({ source, attached }: AbsenceDocSitesInput): ReadonlyArray<Site> {
  const { path, text, parsed } = source;
  const statements = declaringExports({ source });
  const fields: Array<AbsentField> = [];

  /** Keeps a property signature whose type is optional, nullable or an `Option`. */
  const keepSignature: (node: TSPropertySignature) => void = (node) => {
    const annotation = Option.map(Option.fromNullishOr(node.typeAnnotation), ({ start, end }) =>
      text.slice(start, end),
    );

    if (node.optional || Option.exists(annotation, (type) => ABSENCE_TYPE.test(type))) {
      fields.push({ start: node.start, key: text.slice(node.key.start, node.key.end) });
    }
  };

  /** Keeps a field of a declaring export's schema that may be absent. */
  const keepSchemaField: NonNullable<VisitorObject['Property']> = (node) => {
    const isSchemaField = ABSENCE_SCHEMA.test(ownSchema({ text: text.slice(node.value.start, node.value.end) }));
    const isExported = statements.some(({ start, end }) => node.start >= start && node.start < end);

    if (isSchemaField && isExported) {
      fields.push({ start: node.start, key: text.slice(node.key.start, node.key.end) });
    }
  };

  new Visitor({ TSPropertySignature: keepSignature, Property: keepSchemaField }).visit(parsed.program);

  /** Whether no doc comment sits above the field. */
  const isUndocumented: (field: AbsentField) => boolean = ({ start }) => !attached.has(start);

  /** The site of an absent field with no doc comment. */
  const absenceSite: (field: AbsentField) => Site = ({ start, key }) => ({
    rule: DocRule.Absence,
    file: path,
    line: lineAt({ text, offset: start }),
    message: `Say what an absent \`${key}\` means in a doc comment above it, such as \`/** Absent before its first turn */\``,
  });

  return fields.filter(isUndocumented).map(absenceSite);
}

/** A field's own schema: its text before the first object it nests, whose fields the check visits on their own. */
function ownSchema({ text }: SchemaTextInput): string {
  return text.split('{', 1).join('');
}

type YamlScalarInput = { readonly value: string | number };

/** A YAML scalar: a number as written, and a text in single quotes, each of its own quotes doubled. */
export function yamlScalar({ value }: YamlScalarInput): string {
  if (typeof value === 'number') {
    return String(value);
  }

  return `'${value.replaceAll("'", "''")}'`;
}

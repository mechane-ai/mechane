/** A list of names, some perhaps held more than once. */
type RepeatedNamesInput = { readonly names: ReadonlyArray<string> };

/** Each name that the list holds more than once, once. */
export function repeatedNames({ names }: RepeatedNamesInput): ReadonlyArray<string> {
  const isRepeat: (name: string, index: number) => boolean = (name, index) => names.indexOf(name) !== index;

  return [...new Set(names.filter(isRepeat))];
}

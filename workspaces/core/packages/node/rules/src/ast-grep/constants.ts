/** The folder of the ast-grep rules, which are authored, relative to the workspace. */
export const AST_GREP_RULES = 'lint/ast-grep/rules';

/** The folder of the ast-grep utilities, most of which the registry generates, relative to the workspace. */
export const AST_GREP_UTILITIES = 'lint/ast-grep/utils';

/** The folder of each ast-grep rule's generated test, relative to the workspace, which `ast-grep test` reads. */
export const AST_GREP_TESTS = 'lint/ast-grep/tests';

/** The comment that opens every generated YAML file. */
export const GENERATED_HEADER =
  '# Generated from @mechane/rules by `mise run fix`; change the registry, never this file.';
